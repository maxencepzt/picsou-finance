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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExchangeRewardSyncTest {

    private static final Clock TODAY = Clock.fixed(Instant.parse("2026-11-08T12:00:00Z"), ZoneOffset.UTC);
    // 180 days before 2026-11-08 is 2026-05-12: May is only partly read, so June is the first month.
    private static final Instant FIRST_WHOLE_MONTH = Instant.parse("2026-06-01T00:00:00Z");

    @Mock AccountRepository accountRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock PriceService priceService;
    @Mock PriceSnapshotRepository priceSnapshotRepository;
    @Mock CryptoExchangePort adapter;
    @Mock PlatformTransactionManager transactionManager;

    private ExchangeRewardSync rewardSync;
    private final Account account = Account.builder().id(22L).build();

    @BeforeEach
    void setUp() {
        rewardSync = new ExchangeRewardSync(accountRepository, transactionRepository, priceService,
            priceSnapshotRepository, TODAY, transactionManager);
        lenient().when(accountRepository.findById(22L)).thenReturn(Optional.of(account));
        lenient().when(transactionRepository.findByAccountIdAndExternalId(eq(22L), anyString()))
            .thenReturn(Optional.empty());
    }

    @Test
    void writesOneRowPerMonthAndAsset_eachCreditValuedAtItsOwnDay() {
        when(adapter.fetchRewards("key", "secret", FIRST_WHOLE_MONTH)).thenReturn(List.of(
            reward("USDT", "1", "2026-07-01"),
            reward("USDT", "2", "2026-07-20"),
            reward("EGLD", "0.5", "2026-08-03")));
        price("USDT", "2026-07-01", "0.9");
        price("USDT", "2026-07-20", "0.8");
        price("EGLD", "2026-08-03", "10");

        rewardSync.sync(adapter, "key", "secret", ExchangeType.BINANCE, 22L);

        ArgumentCaptor<Transaction> saved = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository, times(2)).save(saved.capture());
        // The key is the one the history import used, so the sync takes those rows over rather
        // than adding a second copy of the same month.
        assertThat(saved.getAllValues())
            .extracting(Transaction::getExternalId, Transaction::getDate, t -> t.getQuantity().toPlainString(),
                t -> t.getAmount().toPlainString())
            .containsExactly(
                tuple("binance-reward:22:2026-07:USDT", LocalDate.parse("2026-07-20"), "3", "2.50"),
                tuple("binance-reward:22:2026-08:EGLD", LocalDate.parse("2026-08-03"), "0.5", "5.00"));
        assertThat(saved.getAllValues()).allSatisfy(row -> {
            assertThat(row.getTxType()).isEqualTo(TransactionType.DIVIDEND);
            assertThat(row.isBudgetNeutral()).isTrue();
            assertThat(row.isManual()).isFalse();
        });
    }

    @Test
    void rewritesTheExistingRowOfAMonthInsteadOfAddingOne() {
        Transaction imported = Transaction.builder().account(account).externalId("binance-reward:22:2026-07:USDT")
            .txType(TransactionType.DIVIDEND).amount(new BigDecimal("1.00")).quantity(BigDecimal.ONE)
            .budgetNeutral(true).isManual(true).build();
        when(transactionRepository.findByAccountIdAndExternalId(22L, "binance-reward:22:2026-07:USDT"))
            .thenReturn(Optional.of(imported));
        when(adapter.fetchRewards("key", "secret", FIRST_WHOLE_MONTH)).thenReturn(List.of(
            reward("USDT", "2", "2026-07-20")));
        price("USDT", "2026-07-20", "0.9");

        rewardSync.sync(adapter, "key", "secret", ExchangeType.BINANCE, 22L);

        verify(transactionRepository).save(imported);
        assertThat(imported.getAmount()).isEqualByComparingTo("1.80");
        assertThat(imported.getQuantity()).isEqualByComparingTo("2");
    }

    @Test
    void leavesAMonthAsItWasWhenOneOfItsCreditsHasNoPrice() {
        // Writing the priced credits alone would replace a correct total with a short one.
        when(adapter.fetchRewards("key", "secret", FIRST_WHOLE_MONTH)).thenReturn(List.of(
            reward("WBETH", "0.001", "2026-07-01"),
            reward("USDT", "1", "2026-07-02")));
        when(priceSnapshotRepository.findLatestByTickerBeforeOrOnDate("WBETH", LocalDate.parse("2026-07-01")))
            .thenReturn(Optional.empty());
        price("USDT", "2026-07-02", "0.9");

        rewardSync.sync(adapter, "key", "secret", ExchangeType.BINANCE, 22L);

        ArgumentCaptor<Transaction> saved = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(saved.capture());
        assertThat(saved.getValue().getExternalId()).isEqualTo("binance-reward:22:2026-07:USDT");
    }

    @Test
    void refusesAPriceMoreThanAWeekOlderThanTheCredit() {
        // A provider failure returns no price rather than throwing, leaving a months-old snapshot
        // as the latest one: valuing July's credits at it would overwrite a correct total.
        when(adapter.fetchRewards("key", "secret", FIRST_WHOLE_MONTH)).thenReturn(List.of(
            reward("EGLD", "0.5", "2026-07-20")));
        when(priceSnapshotRepository.findLatestByTickerBeforeOrOnDate("EGLD", LocalDate.parse("2026-07-20")))
            .thenReturn(Optional.of(PriceSnapshot.builder().ticker("EGLD").date(LocalDate.parse("2026-07-12"))
                .priceEur(BigDecimal.TEN).build()));

        rewardSync.sync(adapter, "key", "secret", ExchangeType.BINANCE, 22L);

        verify(transactionRepository, never()).save(any());
    }

    @Test
    void neverRewritesAMonthDownward() {
        // Rewards only add up: a lower total than stored is a short read (history kept less than
        // the lookback, a reward kind not queried), and the stored figure is the right one.
        Transaction imported = Transaction.builder().account(account).externalId("binance-reward:22:2026-07:ETH")
            .txType(TransactionType.DIVIDEND).amount(new BigDecimal("3.00")).quantity(new BigDecimal("0.001"))
            .budgetNeutral(true).build();
        when(transactionRepository.findByAccountIdAndExternalId(22L, "binance-reward:22:2026-07:ETH"))
            .thenReturn(Optional.of(imported));
        when(adapter.fetchRewards("key", "secret", FIRST_WHOLE_MONTH)).thenReturn(List.of(
            reward("ETH", "0.0004", "2026-07-20")));
        price("ETH", "2026-07-20", "2500");

        rewardSync.sync(adapter, "key", "secret", ExchangeType.BINANCE, 22L);

        verify(transactionRepository, never()).save(any());
        assertThat(imported.getAmount()).isEqualByComparingTo("3.00");
    }

    @Test
    void backfillsAndReadsPricesInTransactionsOfTheirOwn() {
        // It runs from an afterCommit callback, where the finished balance transaction is still
        // bound: price writes outside a new transaction joined it and were never committed, so
        // every month then read as unpriced.
        when(adapter.fetchRewards("key", "secret", FIRST_WHOLE_MONTH)).thenReturn(List.of(
            reward("USDT", "1", "2026-07-01")));
        price("USDT", "2026-07-01", "0.9");

        rewardSync.sync(adapter, "key", "secret", ExchangeType.BINANCE, 22L);

        InOrder order = inOrder(transactionManager, priceService, priceSnapshotRepository, transactionRepository);
        order.verify(transactionManager).getTransaction(any());
        order.verify(priceService).backfillHistoricalPrices(any(), any(), eq(true));
        order.verify(transactionManager).commit(any());
        order.verify(transactionManager).getTransaction(any());
        order.verify(priceSnapshotRepository).findLatestByTickerBeforeOrOnDate(eq("USDT"), any());
        order.verify(transactionRepository).save(any());
        order.verify(transactionManager).commit(any());
    }

    @Test
    void touchesNothingWhenTheExchangeReportsNoReward() {
        when(adapter.fetchRewards(any(), any(), any())).thenReturn(List.of());

        rewardSync.sync(adapter, "key", "secret", ExchangeType.BINANCE, 22L);

        verifyNoInteractions(accountRepository, priceService, priceSnapshotRepository);
        verify(transactionRepository, never()).save(any());
    }

    private static ExchangeReward reward(String asset, String amount, String day) {
        return new ExchangeReward(asset, new BigDecimal(amount), Instant.parse(day + "T08:00:00Z"));
    }

    private void price(String asset, String day, String eur) {
        when(priceSnapshotRepository.findLatestByTickerBeforeOrOnDate(asset, LocalDate.parse(day)))
            .thenReturn(Optional.of(PriceSnapshot.builder().ticker(asset).date(LocalDate.parse(day))
                .priceEur(new BigDecimal(eur)).build()));
    }
}
