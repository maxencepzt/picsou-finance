package com.picsou.service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Return metrics of a dated portfolio series, where the cost basis tells a deposit apart from a
 * gain. Pure: no Spring, no I/O, doubles throughout. The formulas are the API contract's, in
 * {@code docs/features/investment-performance.md}.
 *
 * <p>Every metric that cannot be measured honestly is null, never 0: one point has no return, a
 * month cannot be annualised, and nineteen returns are not a volatility.
 */
public final class PerformanceCalculator {

    static final int MIN_DAYS_ANNUALISED = 365;
    static final int MIN_RETURNS_VOLATILITY = 20;
    static final int MIN_DAYS_XIRR = 30;

    /** One day of the series. {@code invested} null means the cost basis is unknown that day. */
    public record Sample(LocalDate date, double value, Double invested) {}

    /**
     * @param index base-100 running product of the returns, one per sample (empty for no samples)
     */
    public record Result(
        List<Double> index,
        Double twrPercent,
        Double annualizedPercent,
        Double xirrPercent,
        Double volatilityPercent,
        Double maxDrawdownPercent,
        LocalDate maxDrawdownFrom,
        LocalDate maxDrawdownTo
    ) {}

    private PerformanceCalculator() {}

    public static Result compute(List<Sample> samples) {
        int n = samples.size();
        List<Double> index = new ArrayList<>(n);
        List<Double> returns = new ArrayList<>();
        double product = 1;
        long returnDays = 0;

        for (int t = 0; t < n; t++) {
            if (t > 0) {
                Sample prev = samples.get(t - 1);
                Sample cur = samples.get(t);
                // An unknown basis on either side makes the day's flow unknown: skip the
                // return rather than book a deposit as a gain.
                if (prev.value() > 0 && prev.invested() != null && cur.invested() != null) {
                    double flow = cur.invested() - prev.invested();
                    double r = (cur.value() - flow) / prev.value() - 1;
                    product *= 1 + r;
                    returns.add(r);
                    returnDays += ChronoUnit.DAYS.between(prev.date(), cur.date());
                }
            }
            index.add(100 * product);
        }

        long spanDays = n == 0 ? 0 : ChronoUnit.DAYS.between(samples.get(0).date(), samples.get(n - 1).date());

        Double twr = returns.isEmpty() ? null : finite((product - 1) * 100);
        Double annualized = twr == null || spanDays < MIN_DAYS_ANNUALISED || product <= 0
            ? null
            : finite((Math.pow(product, 365.0 / spanDays) - 1) * 100);
        Double volatility = returns.size() < MIN_RETURNS_VOLATILITY
            ? null
            : finite(stdev(returns) * Math.sqrt(365.0 / ((double) returnDays / returns.size())) * 100);

        // Worst peak-to-trough of the index. Zero with no dates when it never fell.
        Double maxDrawdown = null;
        LocalDate drawdownFrom = null;
        LocalDate drawdownTo = null;
        if (n > 0) {
            double peak = index.get(0);
            LocalDate peakDate = samples.get(0).date();
            double worst = 0;
            for (int t = 1; t < n; t++) {
                double level = index.get(t);
                if (level > peak) {
                    peak = level;
                    peakDate = samples.get(t).date();
                } else if (peak > 0 && level / peak - 1 < worst) {
                    worst = level / peak - 1;
                    drawdownFrom = peakDate;
                    drawdownTo = samples.get(t).date();
                }
            }
            maxDrawdown = finite(worst * 100);
        }

        return new Result(index, twr, annualized, xirr(samples, spanDays), volatility,
            maxDrawdown, drawdownFrom, drawdownTo);
    }

    /** −V₀ at the start, −Fₜ on each flow day, +V_T at the end. */
    private static Double xirr(List<Sample> samples, long spanDays) {
        if (spanDays < MIN_DAYS_XIRR) return null;
        if (samples.stream().anyMatch(s -> s.invested() == null)) return null;

        List<Xirr.CashFlow> flows = new ArrayList<>();
        Sample first = samples.get(0);
        flows.add(new Xirr.CashFlow(first.date(), -first.value()));
        for (int t = 1; t < samples.size(); t++) {
            double flow = samples.get(t).invested() - samples.get(t - 1).invested();
            if (flow != 0) flows.add(new Xirr.CashFlow(samples.get(t).date(), -flow));
        }
        Sample last = samples.get(samples.size() - 1);
        flows.add(new Xirr.CashFlow(last.date(), last.value()));

        Double rate = Xirr.solve(flows);
        return rate == null ? null : finite(rate * 100);
    }

    private static double stdev(List<Double> values) {
        double mean = values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double squares = values.stream().mapToDouble(v -> (v - mean) * (v - mean)).sum();
        return Math.sqrt(squares / (values.size() - 1));
    }

    /** NaN or infinity would serialise as an invalid JSON token; it is no answer either. */
    private static Double finite(double value) {
        return Double.isFinite(value) ? value : null;
    }
}
