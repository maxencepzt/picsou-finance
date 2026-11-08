package com.picsou.service;

import com.picsou.model.Account;
import com.picsou.model.ExchangeType;
import com.picsou.model.PriceSnapshot;
import com.picsou.model.Transaction;
import com.picsou.model.TransactionType;
import com.picsou.port.CryptoExchangePort;
import com.picsou.port.CryptoExchangePort.ExchangeReward;
import com.picsou.repository.AccountRepository;
import com.picsou.repository.PriceSnapshotRepository;
import com.picsou.repository.TransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Turns an exchange's yield rewards into one passive-income row per month and asset.
 *
 * <p>Each row is a budget-neutral {@code DIVIDEND} on the exchange account, keyed by
 * {@code <exchange>-reward:<accountId>:<yyyy-MM>:<ASSET>}. A sync re-reads the last
 * {@value #LOOKBACK_DAYS} days and rewrites the rows of every month that window covers whole, so
 * a missed sync catches up and nothing is counted twice. Older months are never touched: their
 * rows come from an earlier sync or a manual import of the exchange's history export.
 *
 * <p>Each credit is valued in EUR at its own day's price, no more than {@value #MAX_PRICE_AGE_DAYS}
 * days older than the credit. A month whose credits cannot all be priced is skipped, keeping any
 * existing row, rather than written short. Neither is a month rewritten downward: rewards only add
 * up, so a total below the stored one can only be a short read (a history kept less than the
 * lookback, a reward kind not queried), and it would erase a correct imported figure.
 */
@Service
public class ExchangeRewardSync {

    private static final Logger log = LoggerFactory.getLogger(ExchangeRewardSync.class);
    static final int LOOKBACK_DAYS = 180;
    static final int MAX_PRICE_AGE_DAYS = 7;

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final PriceService priceService;
    private final PriceSnapshotRepository priceSnapshotRepository;
    private final Clock clock;
    private final TransactionTemplate writeTransaction;

    public ExchangeRewardSync(
        AccountRepository accountRepository,
        TransactionRepository transactionRepository,
        PriceService priceService,
        PriceSnapshotRepository priceSnapshotRepository,
        Clock clock,
        PlatformTransactionManager transactionManager
    ) {
        this.writeTransaction = new TransactionTemplate(transactionManager);
        this.writeTransaction.setPropagationBehavior(TransactionTemplate.PROPAGATION_REQUIRES_NEW);
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
        this.priceService = priceService;
        this.priceSnapshotRepository = priceSnapshotRepository;
        this.clock = clock;
    }

    /**
     * Fetches and writes the rewards of one exchange account. The exchange and price calls run
     * outside any transaction; only the write opens one, of its own, so a failure here never
     * rolls back the balance sync that has just succeeded.
     */
    public void sync(CryptoExchangePort adapter, String apiKey, String apiSecret,
                     ExchangeType exchange, Long accountId) {
        LocalDate today = LocalDate.now(clock);
        // The first month the window covers whole: the month it starts in is only partly read.
        LocalDate from = YearMonth.from(today.minusDays(LOOKBACK_DAYS)).plusMonths(1).atDay(1);
        List<ExchangeReward> rewards = adapter.fetchRewards(apiKey, apiSecret,
            from.atStartOfDay(ZoneOffset.UTC).toInstant());
        if (rewards.isEmpty()) return;

        priceService.backfillHistoricalPrices(
            rewards.stream().map(ExchangeReward::asset).collect(Collectors.toSet()), from, true);

        Map<String, List<ExchangeReward>> byMonthAndAsset = new TreeMap<>(rewards.stream()
            .collect(Collectors.groupingBy(r -> YearMonth.from(day(r)) + ":" + r.asset())));
        Map<String, Optional<BigDecimal>> prices = new HashMap<>();
        List<MonthRow> rows = new ArrayList<>();
        for (var group : byMonthAndAsset.entrySet()) {
            BigDecimal quantity = BigDecimal.ZERO;
            BigDecimal eur = BigDecimal.ZERO;
            LocalDate last = from;
            boolean priced = true;
            for (ExchangeReward reward : group.getValue()) {
                LocalDate day = day(reward);
                Optional<BigDecimal> price = prices.computeIfAbsent(reward.asset() + "@" + day,
                    key -> priceSnapshotRepository.findLatestByTickerBeforeOrOnDate(reward.asset(), day)
                        // A provider failure returns no price rather than throwing, which would
                        // leave a months-old snapshot as the latest one: refuse it.
                        .filter(snapshot -> !snapshot.getDate().isBefore(day.minusDays(MAX_PRICE_AGE_DAYS)))
                        .map(PriceSnapshot::getPriceEur));
                if (price.isEmpty()) {
                    priced = false;
                    break;
                }
                quantity = quantity.add(reward.amount());
                eur = eur.add(reward.amount().multiply(price.get()));
                if (day.isAfter(last)) last = day;
            }
            if (!priced) {
                log.warn("{} rewards {}: no EUR price for every credit -- month left as it was",
                    exchange, group.getKey());
                continue;
            }
            rows.add(new MonthRow(group.getKey(), group.getValue().getFirst().asset(), last,
                quantity, eur.setScale(2, RoundingMode.HALF_UP)));
        }
        writeTransaction.executeWithoutResult(status -> {
            Account account = accountRepository.findById(accountId).orElseThrow();
            int written = 0;
            for (MonthRow row : rows) {
                if (upsert(account, exchange, row)) written++;
            }
            log.info("{} rewards: {} month rows written for account {}", exchange, written, accountId);
        });
    }

    private record MonthRow(String monthAndAsset, String asset, LocalDate date, BigDecimal quantity,
                            BigDecimal eur) {}

    /** False when the stored row is kept: a lower total than stored is a short read. */
    private boolean upsert(Account account, ExchangeType exchange, MonthRow month) {
        String externalId = exchange.name().toLowerCase(Locale.ROOT) + "-reward:"
            + account.getId() + ":" + month.monthAndAsset();
        Optional<Transaction> stored = transactionRepository.findByAccountIdAndExternalId(account.getId(), externalId);
        if (stored.isPresent() && stored.get().getQuantity() != null
            && month.quantity().compareTo(stored.get().getQuantity()) < 0) {
            log.warn("{} rewards {}: read {} below the stored {} -- keeping the stored row",
                exchange, month.monthAndAsset(), month.quantity(), stored.get().getQuantity());
            return false;
        }
        String description = capitalized(exchange) + " rewards " + month.asset();
        Transaction row = stored.orElseGet(() -> Transaction.builder()
            .account(account)
            .externalId(externalId)
            .build());
        row.setTxType(TransactionType.DIVIDEND);
        row.setTicker(month.asset());
        row.setName(month.asset());
        row.setBudgetNeutral(true);
        row.setDate(month.date());
        row.setQuantity(month.quantity());
        row.setAmount(month.eur());
        row.setDescription(description);
        row.setMerchantLabel(description);
        transactionRepository.save(row);
        return true;
    }

    private static LocalDate day(ExchangeReward reward) {
        return LocalDate.ofInstant(reward.time(), ZoneOffset.UTC);
    }

    private static String capitalized(ExchangeType exchange) {
        String name = exchange.name().toLowerCase(Locale.ROOT);
        return Character.toUpperCase(name.charAt(0)) + name.substring(1);
    }
}
