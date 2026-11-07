package com.picsou.service;

import com.picsou.dto.BenchmarkKey;
import com.picsou.dto.BenchmarkResponse;
import com.picsou.dto.DashboardResponse.NetWorthPoint;
import com.picsou.dto.FeesResponse;
import com.picsou.dto.HoldingResponse;
import com.picsou.dto.PerformanceResponse;
import com.picsou.model.Account;
import com.picsou.model.AccountType;
import com.picsou.model.AssetClass;
import com.picsou.model.SecurityProfile;
import com.picsou.model.Transaction;
import com.picsou.model.TransactionType;
import com.picsou.repository.PriceSnapshotRepository;
import com.picsou.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

/**
 * How the investment accounts performed, against what, and at what cost
 * ({@code docs/features/investment-performance.md}).
 *
 * <p>Thin on purpose: the arithmetic lives in {@link PerformanceCalculator} and {@link Xirr};
 * this class only decides which accounts count and in what currency.
 */
@Service
public class InvestmentPerformanceService {

    /** The windows the page offers, in months; 0 is all available history. */
    static final Set<Integer> WINDOWS = Set.of(0, 3, 6, 12, 36, 60);

    /** What "all" means to HistoryService, as DashboardService's ALL range passes it. */
    private static final int ALL_HISTORY_MONTHS = 1200;

    /** "All history" as a query bound: older than any row this app can hold. */
    private static final LocalDate BEGINNING = LocalDate.of(1900, 1, 1);

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final AccountAccessResolver accessResolver;
    private final HistoryService historyService;
    private final AccountService accountService;
    private final SecurityProfileService securityProfileService;
    private final TransactionRepository transactionRepository;
    private final PriceService priceService;
    private final PriceSnapshotRepository priceSnapshotRepository;

    public InvestmentPerformanceService(AccountAccessResolver accessResolver,
                                        HistoryService historyService,
                                        AccountService accountService,
                                        SecurityProfileService securityProfileService,
                                        TransactionRepository transactionRepository,
                                        PriceService priceService,
                                        PriceSnapshotRepository priceSnapshotRepository) {
        this.accessResolver = accessResolver;
        this.historyService = historyService;
        this.accountService = accountService;
        this.securityProfileService = securityProfileService;
        this.transactionRepository = transactionRepository;
        this.priceService = priceService;
        this.priceSnapshotRepository = priceSnapshotRepository;
    }

    @Transactional(readOnly = true)
    public PerformanceResponse performance(Long memberId, int months) {
        requireWindow(months);
        LocalDate today = LocalDate.now();
        List<Long> ids = investmentAccounts(memberId).stream().map(Account::getId).toList();
        // HistoryService already sums balance + invested snapshots with the member's share and
        // swaps today's point for a live valuation: the same series the dashboard chart shows.
        List<NetWorthPoint> history = ids.isEmpty() ? List.of()
            : historyService.buildHistory(ids, months == 0 ? ALL_HISTORY_MONTHS : months, memberId);

        List<PerformanceCalculator.Sample> samples = history.stream()
            .map(p -> new PerformanceCalculator.Sample(p.date(), p.total().doubleValue(),
                p.invested() == null ? null : p.invested().doubleValue()))
            .toList();
        PerformanceCalculator.Result result = PerformanceCalculator.compute(samples);

        List<PerformanceResponse.Point> points = new ArrayList<>(history.size());
        for (int i = 0; i < history.size(); i++) {
            NetWorthPoint p = history.get(i);
            points.add(new PerformanceResponse.Point(p.date(), money(p.total()), money(p.invested()),
                round(result.index().get(i), 4)));
        }

        NetWorthPoint last = history.isEmpty() ? null : history.get(history.size() - 1);
        return new PerformanceResponse(
            history.isEmpty() ? (months == 0 ? today : today.minusMonths(months)) : history.get(0).date(),
            last == null ? today : last.date(),
            last == null ? BigDecimal.ZERO : money(last.total()),
            last == null ? BigDecimal.ZERO : money(last.invested()),
            round(result.twrPercent(), 2),
            round(result.annualizedPercent(), 2),
            round(result.xirrPercent(), 2),
            round(result.volatilityPercent(), 2),
            round(result.maxDrawdownPercent(), 2),
            result.maxDrawdownFrom(),
            result.maxDrawdownTo(),
            points);
    }

    /**
     * Whatever {@code price_snapshot} holds for the benchmark over the window, empty until the
     * jobs have filled it. Never fetches: a GET does not change state, so the rows come from
     * {@code PriceBackfillRunner} (5y at startup) and {@code SchedulerService.refreshPrices}
     * (one a day).
     */
    @Transactional(readOnly = true)
    public BenchmarkResponse benchmark(BenchmarkKey key, int months) {
        requireWindow(months);
        LocalDate to = LocalDate.now();
        LocalDate from = months == 0 ? BEGINNING : to.minusMonths(months);
        List<BenchmarkResponse.Point> points = priceSnapshotRepository
            .findByTickerInAndDateBetween(Set.of(key.ticker()), from, to).stream()
            .map(s -> new BenchmarkResponse.Point(s.getDate(), s.getPriceEur()))
            .toList();
        return new BenchmarkResponse(key, key.ticker(), key.label(), points);
    }

    @Transactional(readOnly = true)
    public FeesResponse fees(Long memberId, int months) {
        requireWindow(months);
        List<Account> accounts = investmentAccounts(memberId);
        Map<Long, BigDecimal> shares = accessResolver.sharesFor(accounts, memberId);

        // A coin and a listed fund can share a symbol; keep them apart, as the price paths do.
        record Key(String ticker, boolean crypto) {}
        Map<Key, BigDecimal> valueByLine = new LinkedHashMap<>();
        Map<Key, String> nameByLine = new HashMap<>();
        for (Account account : accounts) {
            boolean crypto = account.getType() == AccountType.CRYPTO;
            for (HoldingResponse holding : accountService.getHoldings(account)) {
                if (holding.ticker() == null || holding.currentValueEur() == null) continue;
                BigDecimal value = AccountAccessResolver.weigh(holding.currentValueEur(), shares.get(account.getId()));
                if (value.signum() <= 0) continue;
                Key key = new Key(holding.ticker().toUpperCase(Locale.ROOT), crypto);
                valueByLine.merge(key, value, BigDecimal::add);
                nameByLine.putIfAbsent(key, holding.name());
            }
        }

        Map<String, SecurityProfile> profiles = securityProfileService.load(
            valueByLine.keySet().stream().filter(k -> !k.crypto()).map(Key::ticker).toList());

        List<FeesResponse.Line> lines = new ArrayList<>();
        BigDecimal covered = BigDecimal.ZERO;
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal weighted = BigDecimal.ZERO; // Σ value × TER
        for (Map.Entry<Key, BigDecimal> entry : valueByLine.entrySet()) {
            Key key = entry.getKey();
            BigDecimal value = entry.getValue();
            SecurityProfile profile = key.crypto() ? null : profiles.get(key.ticker());
            // A share's profile has no TER, so it falls out here with the coins.
            BigDecimal ter = profile == null ? null : profile.getTerPercent();
            lines.add(new FeesResponse.Line(key.ticker(), nameByLine.get(key), money(value), ter));
            total = total.add(value);
            if (ter != null) {
                covered = covered.add(value);
                weighted = weighted.add(value.multiply(ter));
            }
        }
        lines.sort(Comparator.comparing(FeesResponse.Line::valueEur).reversed());
        boolean anyTer = covered.signum() > 0;

        LocalDate to = LocalDate.now();
        LocalDate from = months == 0 ? null : to.minusMonths(months);
        Map<Long, Account> byId = new HashMap<>();
        accounts.forEach(a -> byId.put(a.getId(), a));
        BigDecimal brokerFees = BigDecimal.ZERO;
        int brokerFeesCount = 0;
        LocalDate earliest = to;
        List<Transaction> transactions = accounts.isEmpty() ? List.of()
            : transactionRepository.findByAccountIdInAndDateBetweenOrderByDateAsc(
                byId.keySet(), from == null ? BEGINNING : from, to);
        for (Transaction tx : transactions) {
            if (tx.getDate().isBefore(earliest)) earliest = tx.getDate();
            BigDecimal fee = tx.getFees() == null ? BigDecimal.ZERO : tx.getFees().abs();
            if (tx.getTxType() == TransactionType.FEE) fee = fee.add(tx.getAmount().abs());
            if (fee.signum() == 0) continue;
            Account account = byId.get(tx.getAccount().getId());
            // shortcut: converted at today's FX rate, not the trade date's; exact for EUR accounts.
            BigDecimal feeEur = priceService.toEur(fee, account.getCurrency(), null);
            brokerFees = brokerFees.add(AccountAccessResolver.weigh(feeEur, shares.get(account.getId())));
            brokerFeesCount++;
        }

        return new FeesResponse(
            from == null ? earliest : from,
            to,
            anyTer ? weighted.divide(covered, 3, RoundingMode.HALF_UP) : null,
            anyTer ? weighted.divide(HUNDRED, 2, RoundingMode.HALF_UP) : null,
            money(covered),
            money(total),
            lines,
            money(brokerFees),
            brokerFeesCount);
    }

    /**
     * The member's non-hidden accounts that hold positions, the set {@link AssetClass#INVESTMENT}
     * names. Pocket sub-accounts are left out like the dashboard leaves them out: their balance is
     * already counted in the parent wallet.
     */
    private List<Account> investmentAccounts(Long memberId) {
        return accessResolver.readableAccounts(memberId).stream()
            .filter(a -> !a.isHidden() && a.getParentAccountId() == null)
            .filter(a -> a.getType() != null && AssetClass.of(a.getType()) == AssetClass.INVESTMENT)
            .toList();
    }

    private static void requireWindow(int months) {
        if (!WINDOWS.contains(months)) {
            throw new IllegalArgumentException("months must be one of 0, 3, 6, 12, 36, 60");
        }
    }

    private static BigDecimal money(BigDecimal amount) {
        return amount == null ? null : amount.setScale(2, RoundingMode.HALF_UP);
    }

    private static Double round(Double value, int digits) {
        return value == null ? null
            : BigDecimal.valueOf(value).setScale(digits, RoundingMode.HALF_UP).doubleValue();
    }
}
