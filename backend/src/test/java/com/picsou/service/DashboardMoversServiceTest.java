package com.picsou.service;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.picsou.dto.HoldingLogoUrls;
import com.picsou.dto.MoversResponse;
import com.picsou.dto.MoversResponse.Mover;
import com.picsou.model.Account;
import com.picsou.model.AccountHolding;
import com.picsou.model.AccountType;
import com.picsou.model.PriceSnapshot;
import com.picsou.repository.AccountHoldingRepository;
import com.picsou.repository.PriceSnapshotRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardMoversServiceTest {

    private static final long MEMBER = 7L;
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 3);

    @Mock AccountAccessResolver access;
    @Mock AccountHoldingRepository holdings;
    @Mock PriceSnapshotRepository snapshots;
    @Mock InstrumentLogoService logos;

    private DashboardMoversService service;

    private final Account pea = account(1L, AccountType.PEA, false);
    private final Account cto = account(2L, AccountType.COMPTE_TITRES, false);
    private final Account wallet = account(3L, AccountType.CRYPTO, false);
    private final Account checking = account(4L, AccountType.CHECKING, false);
    private final Account hiddenCto = account(5L, AccountType.COMPTE_TITRES, true);

    @BeforeEach
    void setUp() {
        service = new DashboardMoversService(access, holdings, snapshots, logos);
    }

    @Test
    void mergesByTickerAcrossAccounts_andSplitsGainersFromLosers() {
        givenAccounts(Map.of(1L, "100", 2L, "50", 3L, "100"));
        when(holdings.findPositiveByAccountIdIn(argThat(ids -> Set.copyOf(ids).equals(Set.of(1L, 2L, 3L)))))
            .thenReturn(List.of(
                holding(pea, "AAPL", "Apple", "10"),
                // 20 on a half-owned CTO is 10 for this member: 20 in total with the PEA line.
                holding(cto, "aapl", null, "20"),
                holding(pea, "MC.PA", "LVMH", "4"),
                holding(wallet, "BTC", "Bitcoin", "0.5"),
                holding(cto, "NEW.PA", "Newcomer", "5")));
        when(snapshots.findRecentByTickers(anySet(), eq(TODAY.minusDays(10)), eq(TODAY))).thenReturn(List.of(
            snapshot("AAPL", "2026-11-03", "190.10"), snapshot("AAPL", "2026-10-31", "185.00"),
            snapshot("BTC", "2026-11-03", "60000"), snapshot("BTC", "2026-11-02", "63000"),
            snapshot("MC.PA", "2026-10-31", "600"), snapshot("MC.PA", "2026-10-30", "612"),
            // A single day cannot move: ignored.
            snapshot("NEW.PA", "2026-11-03", "10")));
        // Stored marks are asked for shares and funds only, never for the crypto line.
        when(logos.storedUrls(argThat(t -> Set.copyOf(t).equals(Set.of("AAPL", "MC.PA", "NEW.PA")))))
            .thenReturn(Map.of("AAPL", HoldingLogoUrls.of("/api/instrument-logos/AAPL?v=1")));

        MoversResponse movers = service.movers(MEMBER, TODAY, 5);

        assertThat(movers.date()).isEqualTo(LocalDate.of(2026, 11, 3));
        assertThat(movers.previousDate()).isEqualTo(LocalDate.of(2026, 11, 2));
        assertThat(movers.gainers()).extracting(Mover::ticker).containsExactly("AAPL");
        Mover apple = movers.gainers().get(0);
        assertThat(apple.name()).isEqualTo("Apple");
        assertThat(apple.logoUrl()).isEqualTo("/api/instrument-logos/AAPL?v=1");
        assertThat(apple.priceEur()).isEqualByComparingTo("190.10");
        assertThat(apple.previousPriceEur()).isEqualByComparingTo("185.00");
        // 5.10 / 185 = 2.7568 %; 20 × 190.10; 20 × 5.10.
        assertThat(apple.changePercent()).isEqualByComparingTo("2.76");
        assertThat(apple.valueEur()).isEqualByComparingTo("3802.00");
        assertThat(apple.valueChangeEur()).isEqualByComparingTo("102.00");

        // Worst first: -3000 / 63000 = -4.76 %, then -12 / 612 = -1.96 %.
        assertThat(movers.losers()).extracting(Mover::ticker).containsExactly("BTC", "MC.PA");
        Mover btc = movers.losers().get(0);
        assertThat(btc.changePercent()).isEqualByComparingTo("-4.76");
        assertThat(btc.valueEur()).isEqualByComparingTo("30000.00");
        assertThat(btc.valueChangeEur()).isEqualByComparingTo("-1500.00");
        assertThat(btc.logoUrl()).isNull();
        Mover lvmh = movers.losers().get(1);
        assertThat(lvmh.changePercent()).isEqualByComparingTo("-1.96");
        assertThat(lvmh.valueEur()).isEqualByComparingTo("2400.00");
        assertThat(lvmh.valueChangeEur()).isEqualByComparingTo("-48.00");
        assertThat(lvmh.logoUrl()).isNull();
    }

    @Test
    void clampsTheLimitTo1Through10_perList() {
        givenAccounts(Map.of(1L, "100"));
        List<AccountHolding> lines = new ArrayList<>();
        List<PriceSnapshot> rows = new ArrayList<>();
        for (int i = 1; i <= 12; i++) {
            String ticker = "T%02d".formatted(i);
            lines.add(holding(pea, ticker, ticker, "1"));
            rows.add(snapshot(ticker, "2026-11-03", String.valueOf(100 + i)));
            rows.add(snapshot(ticker, "2026-10-31", "100"));
        }
        when(holdings.findPositiveByAccountIdIn(anyCollection())).thenReturn(lines);
        when(snapshots.findRecentByTickers(anySet(), eq(TODAY.minusDays(10)), eq(TODAY))).thenReturn(rows);
        when(logos.storedUrls(anyCollection())).thenReturn(Map.of());

        MoversResponse many = service.movers(MEMBER, TODAY, 50);
        MoversResponse one = service.movers(MEMBER, TODAY, 0);

        assertThat(many.gainers()).hasSize(10);
        assertThat(many.gainers().get(0).ticker()).isEqualTo("T12");
        assertThat(many.gainers().get(9).ticker()).isEqualTo("T03");
        assertThat(one.gainers()).extracting(Mover::ticker).containsExactly("T12");
        assertThat(one.losers()).isEmpty();
    }

    @Test
    void datesAreNull_whenNothingHasTwoSnapshots() throws Exception {
        givenAccounts(Map.of(1L, "100"));
        when(holdings.findPositiveByAccountIdIn(anyCollection()))
            .thenReturn(List.of(holding(pea, "AAPL", "Apple", "1")));
        when(snapshots.findRecentByTickers(anySet(), eq(TODAY.minusDays(10)), eq(TODAY)))
            .thenReturn(List.of(snapshot("AAPL", "2026-11-03", "190")));
        when(logos.storedUrls(anyCollection())).thenReturn(Map.of());

        MoversResponse movers = service.movers(MEMBER, TODAY, 5);

        assertThat(movers.date()).isNull();
        assertThat(movers.previousDate()).isNull();
        assertThat(movers.gainers()).isEmpty();
        assertThat(movers.losers()).isEmpty();
        // The app serialises with non_null; the contract wants the keys present, as null.
        ObjectMapper json = new ObjectMapper().setSerializationInclusion(JsonInclude.Include.NON_NULL);
        assertThat(json.writeValueAsString(movers)).contains("\"date\":null", "\"previousDate\":null");
    }

    @Test
    void noInvestmentAccount_readsNoHoldings() {
        when(access.readableAccounts(MEMBER)).thenReturn(List.of(checking, hiddenCto));

        MoversResponse movers = service.movers(MEMBER, TODAY, 5);

        assertThat(movers.date()).isNull();
        assertThat(movers.gainers()).isEmpty();
        verify(holdings, never()).findPositiveByAccountIdIn(anyCollection());
    }

    /** Every account is readable; only the investment ones that are not hidden get a share lookup. */
    private void givenAccounts(Map<Long, String> sharesById) {
        when(access.readableAccounts(MEMBER)).thenReturn(List.of(pea, cto, wallet, checking, hiddenCto));
        Map<Long, BigDecimal> shares = new HashMap<>();
        sharesById.forEach((id, share) -> shares.put(id, new BigDecimal(share)));
        when(access.sharesFor(argThat(accounts -> accounts.stream().map(Account::getId).toList()
            .equals(List.of(1L, 2L, 3L))), eq(MEMBER))).thenReturn(shares);
    }

    private static Account account(long id, AccountType type, boolean hidden) {
        return Account.builder().id(id).name("A" + id).type(type).currency("EUR").hidden(hidden).build();
    }

    private static AccountHolding holding(Account account, String ticker, String name, String quantity) {
        return AccountHolding.builder().account(account).ticker(ticker).name(name)
            .quantity(new BigDecimal(quantity)).build();
    }

    private static PriceSnapshot snapshot(String ticker, String date, String price) {
        return PriceSnapshot.builder().ticker(ticker).date(LocalDate.parse(date)).priceEur(new BigDecimal(price)).build();
    }
}
