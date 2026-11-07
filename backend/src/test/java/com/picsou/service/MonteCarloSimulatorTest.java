package com.picsou.service;

import com.picsou.model.WealthTier;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class MonteCarloSimulatorTest {

    private static boolean[] never(int years) {
        return new boolean[years * 12 + 1];
    }

    private static boolean[] always(int years) {
        boolean[] active = new boolean[years * 12 + 1];
        Arrays.fill(active, 1, active.length, true);
        return active;
    }

    @Test
    void aPassbookHasNoRiskSoEveryFutureIsTheSame() {
        var source = new MonteCarloSimulator.Source(WealthTier.SAFETY_NET, 2.0, 10_000, 0, never(10));

        var result = MonteCarloSimulator.run(List.of(source), 10, 500, 1L);

        double compounded = 10_000 * Math.pow(1.02, 10);
        assertThat(result.percentile(10, 5)).isCloseTo(compounded, within(0.01));
        assertThat(result.percentile(10, 95)).isCloseTo(compounded, within(0.01));
        assertThat(result.shareWithDrawdown()).isZero();
        assertThat(result.shareBelowContributed()).isZero();
    }

    @Test
    void theSameSeedDrawsTheSameFutures() {
        var source = new MonteCarloSimulator.Source(WealthTier.EQUITY, 7.5, 50_000, 300, always(20));

        var first = MonteCarloSimulator.run(List.of(source), 20, 1000, 42L);
        var second = MonteCarloSimulator.run(List.of(source), 20, 1000, 42L);

        assertThat(second.percentile(20, 50)).isEqualTo(first.percentile(20, 50));
        assertThat(second.worstDrawdowns()).containsExactly(first.worstDrawdowns());
    }

    @Test
    void equitiesSpreadAroundTheirExpectedRateWithTheMedianBelowTheMean() {
        var source = new MonteCarloSimulator.Source(WealthTier.EQUITY, 7.5, 100_000, 0, never(20));

        var result = MonteCarloSimulator.run(List.of(source), 20, 4000, 7L);

        double steady = 100_000 * Math.pow(1.075, 20);
        double mean = Arrays.stream(result.yearly()[20]).average().orElseThrow();
        // The mean path is the reference curve; the volatility drag puts the median under it.
        assertThat(mean).isCloseTo(steady, within(steady * 0.06));
        assertThat(result.percentile(20, 50)).isLessThan(steady);
        assertThat(result.percentile(20, 10)).isLessThan(result.percentile(20, 50));
        assertThat(result.percentile(20, 90)).isGreaterThan(result.percentile(20, 50));
        // Over twenty years an equity portfolio almost always goes through a 20 % fall.
        assertThat(result.shareWithDrawdown()).isGreaterThan(0.5);
    }

    @Test
    void contributionsArePaidOnlyWhileThePlanIsActive() {
        boolean[] firstYear = new boolean[2 * 12 + 1];
        Arrays.fill(firstYear, 1, 13, true);
        var plan = new MonteCarloSimulator.Source(WealthTier.SAFETY_NET, 0, 0, 100, firstYear);

        var result = MonteCarloSimulator.run(List.of(plan), 2, 10, 1L);

        assertThat(result.contributed()).containsExactly(0, 1200, 1200);
        assertThat(result.percentile(2, 50)).isCloseTo(1200, within(0.01));
    }

    @Test
    void freshMoneyDoesNotHideAFall() {
        // The same market, once with a large monthly contribution and once without: the deepest
        // fall is a property of the market, so both must report the same one.
        var alone = new MonteCarloSimulator.Source(WealthTier.EQUITY, 7.5, 20_000, 0, never(20));
        var fed = new MonteCarloSimulator.Source(WealthTier.EQUITY, 7.5, 20_000, 2_000, always(20));

        var without = MonteCarloSimulator.run(List.of(alone), 20, 500, 3L);
        var with = MonteCarloSimulator.run(List.of(fed), 20, 500, 3L);

        assertThat(with.medianWorstDrawdown()).isCloseTo(without.medianWorstDrawdown(), within(1e-9));
        assertThat(with.shareWithDrawdown()).isEqualTo(without.shareWithDrawdown());
    }
}
