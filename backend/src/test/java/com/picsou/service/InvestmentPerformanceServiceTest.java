package com.picsou.service;

import com.picsou.dto.BenchmarkKey;
import com.picsou.dto.BenchmarkResponse;
import com.picsou.dto.DashboardResponse.NetWorthPoint;
import com.picsou.dto.FeesResponse;
import com.picsou.dto.HoldingResponse;
import com.picsou.dto.PerformanceResponse;
import com.picsou.model.Account;
import com.picsou.model.AccountType;
import com.picsou.model.PriceSnapshot;
import com.picsou.model.SecurityProfile;
import com.picsou.model.Transaction;
import com.picsou.model.TransactionType;
import com.picsou.repository.PriceSnapshotRepository;
import com.picsou.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvestmentPerformanceServiceTest {

    private static final Long MEMBER = 7L;

    @Mock AccountAccessResolver accessResolver;
    @Mock HistoryService historyService;
    @Mock AccountService accountService;
    @Mock SecurityProfileService securityProfileService;
    @Mock TransactionRepository transactionRepository;
    @Mock PriceService priceService;
    @Mock PriceSnapshotRepository priceSnapshotRepository;

    @InjectMocks InvestmentPerformanceService service;

    private final List<Account> accounts = new ArrayList<>();
    private final Map<Long, BigDecimal> shares = new HashMap<>();

    @BeforeEach
    void wire() {
        lenient().when(accessResolver.readableAccounts(MEMBER)).thenReturn(accounts);
        lenient().when(accessResolver.sharesFor(any(), eq(MEMBER))).thenReturn(shares);
    }

    private Account account(long id, AccountType type, String share) {
        Account a = Account.builder().id(id).name(type.name()).type(type).build();
        accounts.add(a);
        shares.put(id, new BigDecimal(share));
        return a;
    }

    private static HoldingResponse holding(String ticker, String valueEur) {
        return new HoldingResponse(ticker, ticker + " name", null, null, BigDecimal.ONE, null, null, "EUR",
            new BigDecimal(valueEur), null, null, null, null, null, false);
    }

    // ─── performance ─────────────────────────────────────────────────────────

    @Test
    void performance_readsOnlyTheNonHiddenInvestmentAccounts() {
        account(1, AccountType.PEA, "100");
        account(2, AccountType.CHECKING, "100");
        account(3, AccountType.COMPTE_TITRES, "100").setHidden(true);
        account(4, AccountType.EMPLOYEE_SAVINGS, "100");
        account(5, AccountType.CRYPTO, "100").setParentAccountId(1L);
        LocalDate d0 = LocalDate.now().minusDays(1);
        when(historyService.buildHistory(List.of(1L, 4L), 12, MEMBER)).thenReturn(List.of(
            new NetWorthPoint(d0, new BigDecimal("1000"), new BigDecimal("1000"), BigDecimal.ZERO),
            new NetWorthPoint(d0.plusDays(1), new BigDecimal("1100.00004"), new BigDecimal("1000"), null)));

        PerformanceResponse r = service.performance(MEMBER, 12);

        assertThat(r.from()).isEqualTo(d0);
        assertThat(r.to()).isEqualTo(d0.plusDays(1));
        assertThat(r.valueEur()).isEqualByComparingTo("1100.00");
        assertThat(r.investedEur()).isEqualByComparingTo("1000");
        assertThat(r.twrPercent()).isEqualTo(10.0);
        // One day: no annualisation, no volatility, no XIRR.
        assertThat(r.annualizedPercent()).isNull();
        assertThat(r.volatilityPercent()).isNull();
        assertThat(r.xirrPercent()).isNull();
        assertThat(r.points()).extracting(PerformanceResponse.Point::index).containsExactly(100.0, 110.0);
    }

    @Test
    void performance_allHistoryAsksForTheDashboardsAllRange() {
        account(1, AccountType.PER, "50");
        when(historyService.buildHistory(List.of(1L), 1200, MEMBER)).thenReturn(List.of());

        PerformanceResponse r = service.performance(MEMBER, 0);

        assertThat(r.from()).isEqualTo(LocalDate.now());
        assertThat(r.points()).isEmpty();
    }

    @Test
    void performance_withoutInvestmentAccounts_isZerosAndNulls() {
        account(2, AccountType.CHECKING, "100");

        PerformanceResponse r = service.performance(MEMBER, 6);

        verifyNoInteractions(historyService);
        assertThat(r.from()).isEqualTo(LocalDate.now().minusMonths(6));
        assertThat(r.valueEur()).isZero();
        assertThat(r.investedEur()).isZero();
        assertThat(r.twrPercent()).isNull();
        assertThat(r.maxDrawdownPercent()).isNull();
        assertThat(r.points()).isEmpty();
    }

    @Test
    void performance_rejectsAWindowOffTheList() {
        assertThatThrownBy(() -> service.performance(MEMBER, 7))
            .isInstanceOf(IllegalArgumentException.class);
    }

    // ─── benchmark ───────────────────────────────────────────────────────────

    @Test
    void benchmark_servesTheCacheAndNeverCallsTheProvider() {
        LocalDate from = LocalDate.now().minusMonths(12);
        when(priceSnapshotRepository.findByTickerInAndDateBetween(Set.of("IWDA.AS"), from, LocalDate.now()))
            .thenReturn(List.of(PriceSnapshot.builder().ticker("IWDA.AS").date(from).priceEur(new BigDecimal("98.12")).build()));

        BenchmarkResponse r = service.benchmark(BenchmarkKey.MSCI_WORLD, 12);

        // A GET does not write: the rows come from PriceBackfillRunner and the hourly refresh.
        verifyNoInteractions(priceService);
        assertThat(r.key()).isEqualTo(BenchmarkKey.MSCI_WORLD);
        assertThat(r.ticker()).isEqualTo("IWDA.AS");
        assertThat(r.label()).isEqualTo("MSCI World");
        assertThat(r.points()).containsExactly(new BenchmarkResponse.Point(from, new BigDecimal("98.12")));
    }

    @Test
    void benchmark_allHistoryReadsEveryCachedDay_andIsEmptyBeforeTheJobsRan() {
        BenchmarkResponse r = service.benchmark(BenchmarkKey.CAC40, 0);

        verify(priceSnapshotRepository).findByTickerInAndDateBetween(
            Set.of("C40.PA"), LocalDate.of(1900, 1, 1), LocalDate.now());
        verifyNoInteractions(priceService);
        assertThat(r.points()).isEmpty();
    }

    // ─── fees ────────────────────────────────────────────────────────────────

    @Test
    void fees_mergesTickersAtTheMembersShareAndWeighsTheTer() {
        Account pea = account(1, AccountType.PEA, "100");
        Account cto = account(2, AccountType.COMPTE_TITRES, "50");
        Account wallet = account(3, AccountType.CRYPTO, "100");
        when(accountService.getHoldings(pea)).thenReturn(List.of(holding("IWDA.AS", "10000")));
        when(accountService.getHoldings(cto)).thenReturn(List.of(holding("IWDA.AS", "4000"), holding("AAPL", "3000")));
        when(accountService.getHoldings(wallet)).thenReturn(List.of(holding("BTC", "1000")));
        when(securityProfileService.load(argThat(t -> !t.contains("BTC")))).thenReturn(Map.of(
            "IWDA.AS", SecurityProfile.builder().ticker("IWDA.AS").assetType("ETF").terPercent(new BigDecimal("0.20")).build(),
            "AAPL", SecurityProfile.builder().ticker("AAPL").assetType("STOCK").build()));
        when(priceService.toEur(any(), eq("EUR"), isNull())).thenAnswer(inv -> inv.getArgument(0));
        when(transactionRepository.findByAccountIdInAndDateBetweenOrderByDateAsc(
            eq(Set.of(1L, 2L, 3L)), eq(LocalDate.now().minusMonths(12)), eq(LocalDate.now())))
            .thenReturn(List.of(
                tx(pea, TransactionType.BUY, "-500", "2.50"),
                tx(cto, TransactionType.FEE, "-10", null),
                tx(pea, TransactionType.BUY, "-500", null)));

        FeesResponse r = service.fees(MEMBER, 12);

        // IWDA: 10000 + 50 % of 4000; AAPL: 50 % of 3000; BTC whole.
        assertThat(r.lines()).extracting(FeesResponse.Line::ticker).containsExactly("IWDA.AS", "AAPL", "BTC");
        assertThat(r.lines().get(0).valueEur()).isEqualByComparingTo("12000");
        assertThat(r.lines().get(0).terPercent()).isEqualByComparingTo("0.20");
        assertThat(r.lines().get(1).terPercent()).isNull();
        assertThat(r.lines().get(2).terPercent()).isNull();
        assertThat(r.coveredValueEur()).isEqualByComparingTo("12000");
        assertThat(r.totalValueEur()).isEqualByComparingTo("14500");
        assertThat(r.weightedTerPercent()).isEqualByComparingTo("0.200");
        assertThat(r.annualCostEur()).isEqualByComparingTo("24.00");
        // 2.50 fee on a buy, plus half of a 10 € custody fee; the fee-less buy does not count.
        assertThat(r.brokerFeesEur()).isEqualByComparingTo("7.50");
        assertThat(r.brokerFeesCount()).isEqualTo(2);
    }

    @Test
    void fees_withoutAnyTer_isNullNotZero() {
        Account pea = account(1, AccountType.PEA, "100");
        when(accountService.getHoldings(pea)).thenReturn(List.of(holding("AAPL", "3000")));
        when(securityProfileService.load(any())).thenReturn(Map.of());

        FeesResponse r = service.fees(MEMBER, 3);

        assertThat(r.weightedTerPercent()).isNull();
        assertThat(r.annualCostEur()).isNull();
        assertThat(r.coveredValueEur()).isZero();
        assertThat(r.totalValueEur()).isEqualByComparingTo("3000");
        assertThat(r.brokerFeesEur()).isZero();
        assertThat(r.brokerFeesCount()).isZero();
    }

    private static Transaction tx(Account account, TransactionType type, String amount, String fees) {
        return Transaction.builder().account(account).date(LocalDate.now().minusDays(3)).description("t")
            .amount(new BigDecimal(amount)).txType(type).fees(fees == null ? null : new BigDecimal(fees)).build();
    }
}
