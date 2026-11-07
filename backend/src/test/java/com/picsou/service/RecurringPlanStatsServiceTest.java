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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecurringPlanStatsServiceTest {

    private static final long MEMBER = 7L;
    private static final long GOAL = 3L;
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 3);

    @Mock GoalRepository goals;
    @Mock TransactionRepository transactions;
    @Mock PriceService prices;
    @Mock AccountAccessResolver access;

    private RecurringPlanStatsService service;

    private final Account pea = Account.builder().id(1L).name("PEA").type(AccountType.PEA).currency("EUR").build();
    private final Account wallet = Account.builder().id(2L).name("Wallet").type(AccountType.CRYPTO).currency("EUR").build();

    @BeforeEach
    void setUp() {
        service = new RecurringPlanStatsService(goals, transactions, prices, access);
    }

    @Test
    void countsAllocationBuysInTheWindow_andValuesThemAtTodaysPrice() {
        Goal plan = plan(LocalDate.of(2026, 1, 15), null, "CW8.PA", "BTC");
        when(goals.findByIdAndMemberId(GOAL, MEMBER)).thenReturn(Optional.of(plan));
        // Window: Dec 2025 … Nov 2026, cut to the plan's start on 2026-01-15.
        when(transactions.findByAccountIdInAndDateBetweenOrderByDateAsc(
            argThat(ids -> Set.copyOf(ids).equals(Set.of(1L, 2L))),
            eq(LocalDate.of(2026, 1, 15)), eq(TODAY))).thenReturn(List.of(
                buy(pea, "2026-02-05", "CW8.PA", "1", "500", "1"),        // 501
                buy(pea, "2026-03-05", "CW8.PA", "1", "520", "1"),        // 521
                buy(pea, "2026-03-20", "cw8.pa", "0.5", "530", null),     // 265, same month
                cryptoBuyWithoutUnitPrice("2026-04-10", "0.01", "-600"),  // 600, the booked amount
                buy(pea, "2026-04-10", "AAPL", "1", "180", null),         // not in the plan
                row(pea, "2026-05-05", TransactionType.SELL, "CW8.PA", "1"),
                row(pea, "2026-06-05", TransactionType.DIVIDEND, "CW8.PA", null)));
        when(access.sharesFor(anyCollection(), eq(MEMBER))).thenReturn(Map.of(1L, bd("100"), 2L, bd("100")));
        when(prices.getQuotes(Set.of("CW8.PA"))).thenReturn(Map.of("CW8.PA", quote("600")));
        when(prices.getCryptoQuotes(Set.of("BTC"))).thenReturn(Map.of("BTC", quote("70000")));

        RecurringStatsResponse stats = service.stats(GOAL, MEMBER, TODAY);

        assertThat(stats.from()).isEqualTo(LocalDate.of(2026, 1, 15));
        assertThat(stats.to()).isEqualTo(TODAY);
        assertThat(stats.investedEur()).isEqualByComparingTo("1887.00");
        assertThat(stats.purchases()).isEqualTo(4);
        assertThat(stats.monthsWithPurchase()).isEqualTo(3);   // Feb, Mar, Apr
        assertThat(stats.monthsElapsed()).isEqualTo(11);       // Jan … Nov
        // 2.5 × 600 + 0.01 × 70 000 = 2200; 2200 − 1887 = 313; 313 / 1887 = 16.59 %.
        assertThat(stats.currentValueEur()).isEqualByComparingTo("2200.00");
        assertThat(stats.gainEur()).isEqualByComparingTo("313.00");
        assertThat(stats.gainPercent()).isEqualByComparingTo("16.59");
    }

    @Test
    void endDateCapsTheWindow_andTheLastTwelveMonthsCapTheStart() {
        Goal plan = plan(null, LocalDate.of(2026, 6, 30), "CW8.PA");
        when(goals.findByIdAndMemberId(GOAL, MEMBER)).thenReturn(Optional.of(plan));
        when(transactions.findByAccountIdInAndDateBetweenOrderByDateAsc(
            anyCollection(), eq(LocalDate.of(2025, 12, 1)), eq(LocalDate.of(2026, 6, 30)))).thenReturn(List.of());

        RecurringStatsResponse stats = service.stats(GOAL, MEMBER, TODAY);

        assertThat(stats.from()).isEqualTo(LocalDate.of(2025, 12, 1));
        assertThat(stats.to()).isEqualTo(LocalDate.of(2026, 6, 30));
        assertThat(stats.monthsElapsed()).isEqualTo(7);        // Dec … Jun
        assertThat(stats.purchases()).isZero();
        assertThat(stats.investedEur()).isEqualByComparingTo("0");
        // Nothing bought: no gain to measure, null rather than 0.
        assertThat(stats.gainEur()).isNull();
        assertThat(stats.gainPercent()).isNull();
    }

    @Test
    void unknownPrice_leavesValueAndGainNull() {
        Goal plan = plan(null, null, "CW8.PA");
        when(goals.findByIdAndMemberId(GOAL, MEMBER)).thenReturn(Optional.of(plan));
        when(transactions.findByAccountIdInAndDateBetweenOrderByDateAsc(anyCollection(), eq(LocalDate.of(2025, 12, 1)), eq(TODAY)))
            .thenReturn(List.of(buy(pea, "2026-02-05", "CW8.PA", "1", "500", null)));
        when(access.sharesFor(anyCollection(), eq(MEMBER))).thenReturn(Map.of(1L, bd("100"), 2L, bd("100")));
        when(prices.getQuotes(Set.of("CW8.PA"))).thenReturn(Map.of());

        RecurringStatsResponse stats = service.stats(GOAL, MEMBER, TODAY);

        assertThat(stats.investedEur()).isEqualByComparingTo("500.00");
        assertThat(stats.purchases()).isEqualTo(1);
        assertThat(stats.currentValueEur()).isNull();
        assertThat(stats.gainEur()).isNull();
        assertThat(stats.gainPercent()).isNull();
    }

    @Test
    void weighsByTheMembersShare() {
        Goal plan = plan(null, null, "CW8.PA");
        when(goals.findByIdAndMemberId(GOAL, MEMBER)).thenReturn(Optional.of(plan));
        when(transactions.findByAccountIdInAndDateBetweenOrderByDateAsc(anyCollection(), eq(LocalDate.of(2025, 12, 1)), eq(TODAY)))
            .thenReturn(List.of(buy(pea, "2026-02-05", "CW8.PA", "2", "100", null)));
        when(access.sharesFor(anyCollection(), eq(MEMBER))).thenReturn(Map.of(1L, bd("50"), 2L, bd("100")));
        when(prices.getQuotes(Set.of("CW8.PA"))).thenReturn(Map.of("CW8.PA", quote("150")));

        RecurringStatsResponse stats = service.stats(GOAL, MEMBER, TODAY);

        // Half of 200 invested, half of 2 × 150 held.
        assertThat(stats.investedEur()).isEqualByComparingTo("100.00");
        assertThat(stats.currentValueEur()).isEqualByComparingTo("150.00");
        assertThat(stats.gainEur()).isEqualByComparingTo("50.00");
        assertThat(stats.gainPercent()).isEqualByComparingTo("50.00");
    }

    @Test
    void savingsTarget_isABadRequest() {
        Goal target = Goal.builder().id(GOAL).name("Trip").type(GoalType.SAVINGS_TARGET).build();
        when(goals.findByIdAndMemberId(GOAL, MEMBER)).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> service.stats(GOAL, MEMBER, TODAY)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void anotherMembersGoal_isNotFound() {
        when(goals.findByIdAndMemberId(GOAL, MEMBER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.stats(GOAL, MEMBER, TODAY)).isInstanceOf(ResourceNotFoundException.class);
    }

    private Goal plan(LocalDate start, LocalDate end, String... tickers) {
        Goal goal = Goal.builder().id(GOAL).name("DCA").type(GoalType.RECURRING_INVESTMENT)
            .monthlyAmount(bd("500")).startDate(start).endDate(end)
            .accounts(new ArrayList<>(List.of(pea, wallet))).build();
        for (String ticker : tickers) {
            goal.getAllocations().add(GoalAllocation.builder().goal(goal).ticker(ticker).monthlyAmount(bd("250")).build());
        }
        return goal;
    }

    private static Transaction buy(Account account, String date, String ticker, String qty, String price, String fees) {
        Transaction tx = row(account, date, TransactionType.BUY, ticker, qty);
        tx.setPricePerUnit(bd(price));
        tx.setFees(fees == null ? null : bd(fees));
        return tx;
    }

    private Transaction cryptoBuyWithoutUnitPrice(String date, String qty, String amount) {
        Transaction tx = row(wallet, date, TransactionType.BUY, "BTC", qty);
        tx.setAmount(bd(amount));
        return tx;
    }

    private static Transaction row(Account account, String date, TransactionType type, String ticker, String qty) {
        return Transaction.builder().account(account).date(LocalDate.parse(date)).txType(type).ticker(ticker)
            .quantity(qty == null ? null : bd(qty)).amount(BigDecimal.ZERO).description("x").build();
    }

    private static PriceService.Quote quote(String price) {
        return new PriceService.Quote(bd(price), TODAY, true);
    }

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }
}
