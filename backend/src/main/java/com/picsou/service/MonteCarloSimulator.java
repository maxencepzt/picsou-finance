package com.picsou.service;

import com.picsou.model.WealthTier;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;

/**
 * Thousands of possible futures for the investable portfolio, month by month.
 *
 * <p>The four scenario curves of {@link ProjectionService} say where the money could end up at a
 * steady rate; none of them ever has a bad year. This draws the bad years: each month, equities
 * and crypto take a random return around their expected rate, and the spread of the results says
 * how likely each outcome is and what the road there looks like.
 *
 * <p>Pure arithmetic on {@code double}: these are probabilities, not ledger amounts, and
 * {@code BigDecimal} would make several million draws per request needlessly slow.
 */
final class MonteCarloSimulator {

    /**
     * Annual volatility per tier, in percent. Long-run figures, not the member's own history,
     * which is too short to estimate one ({@link PerformanceCalculator} needs 20 monthly returns
     * before it reports a volatility at all). Tiers absent from the map do not move randomly.
     */
    static final Map<WealthTier, Double> VOLATILITY = Map.of(
        // A world equity index over several decades.
        WealthTier.EQUITY, 16.0,
        // Bitcoin's historical range; deliberately wide, because it is.
        WealthTier.CRYPTO, 60.0
    );

    /** Equities and crypto fall together more often than not. */
    static final double EQUITY_CRYPTO_CORRELATION = 0.4;

    /** Enough for stable 5th–95th percentiles (about ±1 % between seeds), well under 100 ms. */
    static final int PATHS = 4000;

    /** A drop from a previous high that counts as a hard stretch. */
    static final double DRAWDOWN_THRESHOLD = 0.20;

    private MonteCarloSimulator() {}

    /**
     * Money that grows at one expected rate, optionally fed every month.
     *
     * @param active for each month index from 1 to the horizon, whether the contribution is paid;
     *               index 0 is unused
     */
    record Source(WealthTier tier, double annualPercent, double start, double monthly, boolean[] active) {}

    /**
     * @param yearly      for each year from 0 to the horizon, the portfolio value of every path,
     *                    sorted ascending so percentiles are a lookup
     * @param contributed for each year, the capital paid in (the same on every path)
     * @param worstDrawdowns each path's largest fall from a previous high, as a fraction
     */
    record Result(double[][] yearly, double[] contributed, double[] worstDrawdowns) {

        /** The value below which {@code percent} of the paths end, in a given year. */
        double percentile(int year, double percent) {
            return at(yearly[year], percent);
        }

        /** Share of paths that end the horizon below what was paid in. */
        double shareBelowContributed() {
            int last = yearly.length - 1;
            double floor = contributed[last];
            return share(yearly[last], v -> v < floor - 0.005);
        }

        /** Share of paths that fell at least {@link #DRAWDOWN_THRESHOLD} from a previous high. */
        double shareWithDrawdown() {
            return share(worstDrawdowns, d -> d >= DRAWDOWN_THRESHOLD);
        }

        double medianWorstDrawdown() {
            double[] sorted = worstDrawdowns.clone();
            Arrays.sort(sorted);
            return at(sorted, 50);
        }
    }

    static Result run(List<Source> sources, int years, int paths, long seed) {
        int months = years * 12;
        SplittableRandom random = new SplittableRandom(seed);

        // Per-source constants, computed once rather than in the inner loop.
        int n = sources.size();
        double[] steady = new double[n];
        double[] drift = new double[n];
        double[] sigma = new double[n];
        for (int s = 0; s < n; s++) {
            Source source = sources.get(s);
            double annual = Math.max(source.annualPercent(), -99.0) / 100.0;
            double vol = VOLATILITY.getOrDefault(source.tier(), 0.0) / 100.0;
            steady[s] = Math.pow(1 + annual, 1.0 / 12.0);
            // Log-normal returns whose expected value is the stated rate: the mean path matches
            // the reference curve, and the median sits below it by the volatility drag.
            drift[s] = (Math.log(1 + annual) - vol * vol / 2) / 12.0;
            sigma[s] = vol / Math.sqrt(12.0);
        }

        double[] contributed = new double[years + 1];
        double paidIn = sources.stream().mapToDouble(Source::start).sum();
        contributed[0] = paidIn;
        for (int m = 1; m <= months; m++) {
            for (Source source : sources) {
                if (source.active()[m]) paidIn += source.monthly();
            }
            if (m % 12 == 0) contributed[m / 12] = paidIn;
        }

        double[][] yearly = new double[years + 1][paths];
        double[] worst = new double[paths];
        double[] amounts = new double[n];
        double rest = Math.sqrt(1 - EQUITY_CRYPTO_CORRELATION * EQUITY_CRYPTO_CORRELATION);

        for (int p = 0; p < paths; p++) {
            double total = 0;
            for (int s = 0; s < n; s++) {
                amounts[s] = sources.get(s).start();
                total += amounts[s];
            }
            yearly[0][p] = total;
            double peak = total;
            double deepest = 0;

            for (int m = 1; m <= months; m++) {
                // One market per month: every equity pot takes the same shock, and crypto's is
                // partly the same one.
                double equityShock = random.nextGaussian();
                double cryptoShock = EQUITY_CRYPTO_CORRELATION * equityShock + rest * random.nextGaussian();
                total = 0;
                for (int s = 0; s < n; s++) {
                    Source source = sources.get(s);
                    double factor = switch (source.tier()) {
                        case EQUITY -> Math.exp(drift[s] + sigma[s] * equityShock);
                        case CRYPTO -> Math.exp(drift[s] + sigma[s] * cryptoShock);
                        default -> steady[s];
                    };
                    amounts[s] *= factor;
                    if (source.active()[m]) amounts[s] += source.monthly();
                    total += amounts[s];
                }
                peak = Math.max(peak, total);
                if (peak > 0) deepest = Math.max(deepest, (peak - total) / peak);
                if (m % 12 == 0) yearly[m / 12][p] = total;
            }
            worst[p] = deepest;
        }

        for (double[] year : yearly) Arrays.sort(year);
        return new Result(yearly, contributed, worst);
    }

    /** Nearest-rank percentile of a sorted array. */
    private static double at(double[] sorted, double percent) {
        if (sorted.length == 0) return 0;
        int index = (int) Math.ceil(percent / 100.0 * sorted.length) - 1;
        return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
    }

    private static double share(double[] values, java.util.function.DoublePredicate test) {
        if (values.length == 0) return 0;
        long hits = Arrays.stream(values).filter(test).count();
        return (double) hits / values.length;
    }
}
