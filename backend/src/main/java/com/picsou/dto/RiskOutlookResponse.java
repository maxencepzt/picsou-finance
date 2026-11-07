package com.picsou.dto;

import com.picsou.model.WealthTier;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * The investable portfolio projected over many random futures (Monte-Carlo), with the same base
 * and plans as {@link ProjectionResponse}.
 *
 * <p>Where the scenarios give four steady curves, this gives a range and its odds: half the
 * futures end above the median, eight in ten fall between the 10th and 90th percentiles.
 *
 * @param paths       how many futures were drawn
 * @param points      one band per year, from today to the horizon
 * @param summary     the risk figures stated in words on screen
 * @param assumptions what each tier is assumed to earn and how much it swings, so the screen can
 *                    say what the odds rest on
 */
public record RiskOutlookResponse(
    BigDecimal baseValueEur,
    int years,
    int paths,
    List<Band> points,
    Summary summary,
    List<Assumption> assumptions
) {

    /** Percentiles of the portfolio value on one date; {@code contributedEur} is capital in. */
    public record Band(
        LocalDate date,
        BigDecimal p10Eur,
        BigDecimal p25Eur,
        BigDecimal p50Eur,
        BigDecimal p75Eur,
        BigDecimal p90Eur,
        BigDecimal contributedEur
    ) {}

    /**
     * @param p5Eur                       the value at the horizon in the worst 5 % of futures
     * @param belowContributedPercent     futures that end below the capital paid in
     * @param drawdownPercent             futures that fall at least {@code drawdownThresholdPercent}
     *                                    from a previous high at some point
     * @param drawdownThresholdPercent    that threshold
     * @param medianWorstDrawdownPercent  the deepest fall along the way, in a typical future
     */
    public record Summary(
        BigDecimal p5Eur,
        BigDecimal belowContributedPercent,
        BigDecimal drawdownPercent,
        BigDecimal drawdownThresholdPercent,
        BigDecimal medianWorstDrawdownPercent
    ) {}

    public record Assumption(WealthTier tier, BigDecimal expectedPercent, BigDecimal volatilityPercent) {}
}
