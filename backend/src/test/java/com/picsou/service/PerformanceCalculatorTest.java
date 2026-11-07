package com.picsou.service;

import com.picsou.service.PerformanceCalculator.Result;
import com.picsou.service.PerformanceCalculator.Sample;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class PerformanceCalculatorTest {

    private static final LocalDate D0 = LocalDate.of(2025, 1, 1);

    private static List<Sample> daily(double[] values, double[] invested) {
        List<Sample> samples = new ArrayList<>();
        for (int i = 0; i < values.length; i++) {
            samples.add(new Sample(D0.plusDays(i), values[i], invested[i]));
        }
        return samples;
    }

    private static int close(Double a, Double b) {
        return Math.abs(a - b) < 1e-9 ? 0 : Double.compare(a, b);
    }

    @Test
    void emptySeries_everyMetricIsNull() {
        Result r = PerformanceCalculator.compute(List.of());

        assertThat(r.index()).isEmpty();
        assertThat(r.twrPercent()).isNull();
        assertThat(r.annualizedPercent()).isNull();
        assertThat(r.xirrPercent()).isNull();
        assertThat(r.volatilityPercent()).isNull();
        assertThat(r.maxDrawdownPercent()).isNull();
        assertThat(r.maxDrawdownFrom()).isNull();
    }

    @Test
    void singlePoint_hasNoReturnButAZeroDrawdown() {
        Result r = PerformanceCalculator.compute(List.of(new Sample(D0, 1000, 1000.0)));

        assertThat(r.index()).containsExactly(100.0);
        assertThat(r.twrPercent()).isNull();
        assertThat(r.maxDrawdownPercent()).isZero();
        assertThat(r.maxDrawdownFrom()).isNull();
    }

    @Test
    void flatSeries_isZeroEverywhereItCanBeMeasured() {
        // 40 days at 1000 with 1000 invested: 39 returns of exactly 0, span 39 days.
        double[] flat = new double[40];
        java.util.Arrays.fill(flat, 1000);
        Result r = PerformanceCalculator.compute(daily(flat, flat));

        assertThat(r.index()).hasSize(40).allMatch(i -> i == 100.0);
        assertThat(r.twrPercent()).isZero();
        assertThat(r.volatilityPercent()).isZero();
        assertThat(r.maxDrawdownPercent()).isZero();
        assertThat(r.xirrPercent()).isCloseTo(0, within(1e-6));
        // 39 days cannot be annualised.
        assertThat(r.annualizedPercent()).isNull();
    }

    @Test
    void deposit_isAFlowNotAGain() {
        // Day 1: +1000 deposited and +1000 of value — a return of exactly zero.
        Result r = PerformanceCalculator.compute(daily(new double[]{1000, 2000}, new double[]{1000, 2000}));

        assertThat(r.twrPercent()).isCloseTo(0, within(1e-9));
        assertThat(r.index()).usingElementComparator(PerformanceCalculatorTest::close)
            .containsExactly(100.0, 100.0);
    }

    @Test
    void returnsFromAnEmptyPortfolioAreSkipped() {
        // Nothing held on days 0 and 1: no return can be measured from a zero base.
        Result r = PerformanceCalculator.compute(daily(new double[]{0, 0, 1000}, new double[]{0, 0, 1000}));

        assertThat(r.twrPercent()).isNull();
        assertThat(r.index()).containsExactly(100.0, 100.0, 100.0);
    }

    @Test
    void knownDrawdown_isPeakToTroughWithDates() {
        // 100 → 120 → 90 → 110 → 130, nothing deposited: the trough is 90 after the 120 peak.
        double[] invested = {100, 100, 100, 100, 100};
        Result r = PerformanceCalculator.compute(daily(new double[]{100, 120, 90, 110, 130}, invested));

        assertThat(r.index()).usingElementComparator(PerformanceCalculatorTest::close)
            .containsExactly(100.0, 120.0, 90.0, 110.0, 130.0);
        assertThat(r.twrPercent()).isCloseTo(30, within(1e-9));
        assertThat(r.maxDrawdownPercent()).isCloseTo(-25, within(1e-9));
        assertThat(r.maxDrawdownFrom()).isEqualTo(D0.plusDays(1));
        assertThat(r.maxDrawdownTo()).isEqualTo(D0.plusDays(2));
        // Four returns are not a volatility.
        assertThat(r.volatilityPercent()).isNull();
    }

    @Test
    void oneYearAtTenPercent_annualisesAndXirrsToTen() {
        Result r = PerformanceCalculator.compute(List.of(
            new Sample(D0, 1000, 1000.0),
            new Sample(D0.plusDays(365), 1100, 1000.0)));

        assertThat(r.twrPercent()).isCloseTo(10, within(1e-9));
        assertThat(r.annualizedPercent()).isCloseTo(10, within(1e-9));
        assertThat(r.xirrPercent()).isCloseTo(10, within(1e-6));
    }

    @Test
    void xirr_weighsAMidYearDepositByTheTimeItWasInvested() {
        // 1000 for a year, +1000 deposited at day 182, ends at 2150. Hand-solved:
        // 1000·(1+r) + 1000·(1+r)^(183/365) = 2150 → r ≈ 10.0713 %.
        Result r = PerformanceCalculator.compute(List.of(
            new Sample(D0, 1000, 1000.0),
            new Sample(D0.plusDays(182), 1000, 2000.0),
            new Sample(D0.plusDays(365), 2150, 2000.0)));

        double rate = r.xirrPercent() / 100;
        assertThat(1000 * (1 + rate) + 1000 * Math.pow(1 + rate, 183 / 365.0)).isCloseTo(2150, within(1e-4));
        assertThat(r.xirrPercent()).isCloseTo(10.0713, within(1e-4));
    }

    @Test
    void volatility_annualisesTheStdevOfDailyReturns() {
        // Alternating +1 % / −1 %, 20 returns: sample stdev of ±0.01 over 20 values is
        // 0.01·√(20/19); annualised with a one-day gap, ×√365.
        int n = 21;
        double[] values = new double[n];
        double[] invested = new double[n];
        values[0] = 1000;
        for (int i = 1; i < n; i++) values[i] = values[i - 1] * (i % 2 == 1 ? 1.01 : 0.99);
        java.util.Arrays.fill(invested, 1000);

        Result r = PerformanceCalculator.compute(daily(values, invested));

        double expected = 0.01 * Math.sqrt(20.0 / 19) * Math.sqrt(365) * 100;
        assertThat(r.volatilityPercent()).isCloseTo(expected, within(1e-9));
    }

    @Test
    void unknownBasis_skipsTheReturnAndTheXirr() {
        Result r = PerformanceCalculator.compute(List.of(
            new Sample(D0, 1000, 1000.0),
            new Sample(D0.plusDays(40), 1500, null),
            new Sample(D0.plusDays(80), 1650, 1000.0)));

        // Neither return touching the unknown day is measured.
        assertThat(r.twrPercent()).isNull();
        assertThat(r.xirrPercent()).isNull();
    }
}
