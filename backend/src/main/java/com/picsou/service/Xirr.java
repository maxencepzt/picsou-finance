package com.picsou.service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Money-weighted annual rate of return: the rate at which a dated series of cash flows has a
 * net present value of zero, on the 365-day convention Excel's {@code XIRR} uses.
 *
 * <p>Bisection rather than Newton: daily flows make the derivative noisy, and a bracket either
 * contains a root or proves there is none, so a non-answer is detected instead of diverging.
 */
public final class Xirr {

    /** One cash flow; negative = money put in, positive = money taken out (or the final value). */
    public record CashFlow(LocalDate date, double amount) {}

    /** −99.99 %/yr: at −100 % every discount factor is a division by zero. */
    private static final double LOWEST_RATE = -0.9999;
    /** +1 000 000 %/yr. A bracket that still has no sign change there has no credible root. */
    private static final double HIGHEST_RATE = 10_000;
    private static final double TOLERANCE = 1e-10;
    private static final int MAX_ITERATIONS = 300;

    private Xirr() {}

    /** The annual rate as a fraction (0.1 = 10 %/yr), or null when the flows have no root. */
    public static Double solve(List<CashFlow> flows) {
        if (flows.isEmpty()) return null;
        LocalDate origin = flows.stream().map(CashFlow::date).min(LocalDate::compareTo).orElseThrow();

        double low = LOWEST_RATE;
        double npvLow = npv(flows, origin, low);
        double high = 1;
        double npvHigh = npv(flows, origin, high);
        while (sameSign(npvLow, npvHigh) && high < HIGHEST_RATE) {
            high *= 10;
            npvHigh = npv(flows, origin, high);
        }
        if (!Double.isFinite(npvLow) || !Double.isFinite(npvHigh) || sameSign(npvLow, npvHigh)) {
            return null;
        }

        for (int i = 0; i < MAX_ITERATIONS && high - low > TOLERANCE; i++) {
            double mid = (low + high) / 2;
            double npvMid = npv(flows, origin, mid);
            if (npvMid == 0) return mid;
            if (sameSign(npvMid, npvLow)) {
                low = mid;
                npvLow = npvMid;
            } else {
                high = mid;
            }
        }
        return (low + high) / 2;
    }

    private static double npv(List<CashFlow> flows, LocalDate origin, double rate) {
        double sum = 0;
        for (CashFlow flow : flows) {
            double years = ChronoUnit.DAYS.between(origin, flow.date()) / 365.0;
            sum += flow.amount() / Math.pow(1 + rate, years);
        }
        return sum;
    }

    private static boolean sameSign(double a, double b) {
        return a > 0 && b > 0 || a < 0 && b < 0;
    }
}
