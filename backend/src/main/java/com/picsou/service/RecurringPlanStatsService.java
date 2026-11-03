package com.picsou.service;

import com.picsou.dto.RecurringStatsResponse;
import com.picsou.exception.ResourceNotFoundException;
import com.picsou.model.Account;
import com.picsou.model.AccountType;
import com.picsou.model.Goal;
import com.picsou.model.GoalAllocation;
import com.picsou.model.GoalType;
import com.picsou.model.Transaction;
import com.picsou.model.TransactionType;
import com.picsou.repository.GoalRepository;
import com.picsou.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * What a recurring investment plan actually bought: the {@code BUY} rows of its allocation tickers
 * on its accounts, over the last {@value #WINDOW_MONTHS} calendar months (the current one included)
 * intersected with the plan's own start and end dates.
 */
@Service
@Transactional(readOnly = true)
public class RecurringPlanStatsService {

    static final int WINDOW_MONTHS = 12;

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final GoalRepository goals;
    private final TransactionRepository transactions;
    private final PriceService prices;
    private final AccountAccessResolver access;

    public RecurringPlanStatsService(
        GoalRepository goals,
        TransactionRepository transactions,
        PriceService prices,
        AccountAccessResolver access
    ) {
        this.goals = goals;
        this.transactions = transactions;
        this.prices = prices;
        this.access = access;
    }

    public RecurringStatsResponse stats(Long goalId, Long memberId, LocalDate today) {
        Goal goal = goals.findByIdAndMemberId(goalId, memberId)
            .orElseThrow(() -> ResourceNotFoundException.goal(goalId));
        if (goal.getType() != GoalType.RECURRING_INVESTMENT) {
            throw new IllegalArgumentException("Recurring stats exist only for a recurring investment plan");
        }

        LocalDate from = today.minusMonths(WINDOW_MONTHS - 1L).withDayOfMonth(1);
        if (goal.getStartDate() != null && goal.getStartDate().isAfter(from)) {
            from = goal.getStartDate();
        }
        LocalDate to = goal.getEndDate() != null && goal.getEndDate().isBefore(today) ? goal.getEndDate() : today;
        Set<String> tickers = goal.getAllocations().stream()
            .map(GoalAllocation::getTicker)
            .filter(Objects::nonNull)
            .map(t -> t.trim().toUpperCase(Locale.ROOT))
            .collect(Collectors.toSet());
        // Goal accounts are the member's own: GoalService attaches them through a member-scoped lookup.
        Map<Long, Account> accounts = goal.getAccounts().stream()
            .collect(Collectors.toMap(Account::getId, a -> a, (a, b) -> a));
        if (from.isAfter(to)) {
            // The plan starts after today or ended before the window: nothing has elapsed.
            return new RecurringStatsResponse(from, to, BigDecimal.ZERO, 0, 0, 0, BigDecimal.ZERO, null, null);
        }
        int monthsElapsed = (int) ChronoUnit.MONTHS.between(YearMonth.from(from), YearMonth.from(to)) + 1;

        List<Transaction> buys = tickers.isEmpty() || accounts.isEmpty() ? List.of()
            : transactions.findByAccountIdInAndDateBetweenOrderByDateAsc(accounts.keySet(), from, to).stream()
                .filter(tx -> tx.getTxType() == TransactionType.BUY)
                .filter(tx -> tx.getTicker() != null && tickers.contains(tx.getTicker().trim().toUpperCase(Locale.ROOT)))
                .filter(tx -> tx.getQuantity() != null && tx.getQuantity().signum() != 0)
                .filter(tx -> tx.getAccount() != null && accounts.containsKey(tx.getAccount().getId()))
                .toList();
        if (buys.isEmpty()) {
            return new RecurringStatsResponse(from, to, BigDecimal.ZERO, 0, 0, monthsElapsed, BigDecimal.ZERO, null, null);
        }

        Map<Long, BigDecimal> shares = access.sharesFor(accounts.values(), memberId);
        Map<String, PriceService.Quote> quotes = quotesFor(buys, accounts);
        BigDecimal invested = BigDecimal.ZERO;
        BigDecimal value = BigDecimal.ZERO;
        boolean priced = true;
        Set<YearMonth> months = new HashSet<>();
        for (Transaction tx : buys) {
            BigDecimal share = shares.get(tx.getAccount().getId());
            invested = invested.add(AccountAccessResolver.weigh(cost(tx), share));
            PriceService.Quote quote = quotes.get(tx.getTicker().trim().toUpperCase(Locale.ROOT));
            if (quote == null) {
                priced = false;
            } else {
                value = value.add(AccountAccessResolver.weigh(tx.getQuantity().abs().multiply(quote.price()), share));
            }
            months.add(YearMonth.from(tx.getDate()));
        }
        invested = invested.setScale(2, RoundingMode.HALF_UP);
        // A partial sum would read as a loss the size of the unpriced lines: unknown, not lower.
        BigDecimal currentValue = priced ? value.setScale(2, RoundingMode.HALF_UP) : null;
        BigDecimal gain = currentValue == null ? null : currentValue.subtract(invested);
        BigDecimal gainPercent = gain == null || invested.signum() == 0 ? null
            : gain.multiply(HUNDRED).divide(invested, 2, RoundingMode.HALF_UP);
        return new RecurringStatsResponse(from, to, invested, buys.size(), months.size(), monthsElapsed,
            currentValue, gain, gainPercent);
    }

    /**
     * What a purchase cost, the cost-basis rule of {@code HoldingComputeService}: quantity × price
     * plus fees, or the booked amount when the row carries no unit price.
     */
    private static BigDecimal cost(Transaction tx) {
        if (tx.getPricePerUnit() == null) {
            return tx.getAmount() == null ? BigDecimal.ZERO : tx.getAmount().abs();
        }
        BigDecimal cost = tx.getQuantity().abs().multiply(tx.getPricePerUnit());
        return tx.getFees() == null ? cost : cost.add(tx.getFees().abs());
    }

    /** Today's EUR price of every bought ticker, crypto from CoinGecko only (as AccountService does). */
    private Map<String, PriceService.Quote> quotesFor(List<Transaction> buys, Map<Long, Account> accounts) {
        Set<String> crypto = new HashSet<>();
        Set<String> listed = new HashSet<>();
        for (Transaction tx : buys) {
            String ticker = tx.getTicker().trim().toUpperCase(Locale.ROOT);
            boolean onCrypto = accounts.get(tx.getAccount().getId()).getType() == AccountType.CRYPTO;
            (onCrypto ? crypto : listed).add(ticker);
        }
        Map<String, PriceService.Quote> quotes = new HashMap<>();
        if (!listed.isEmpty()) {
            quotes.putAll(prices.getQuotes(listed));
        }
        if (!crypto.isEmpty()) {
            quotes.putAll(prices.getCryptoQuotes(crypto));
        }
        return quotes;
    }
}
