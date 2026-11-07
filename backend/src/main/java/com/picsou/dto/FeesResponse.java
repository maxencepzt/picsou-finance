package com.picsou.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * What the member's investments cost: the funds' ongoing charges, and the broker fees paid.
 *
 * @param weightedTerPercent value-weighted TER over the lines that have one; null when none does
 * @param annualCostEur      what those TERs cost a year at today's values; null when none
 * @param coveredValueEur    value of the lines with a known TER
 * @param totalValueEur      value of every priced line, covered or not
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record FeesResponse(
    LocalDate from,
    LocalDate to,
    BigDecimal weightedTerPercent,
    BigDecimal annualCostEur,
    BigDecimal coveredValueEur,
    BigDecimal totalValueEur,
    List<Line> lines,
    BigDecimal brokerFeesEur,
    int brokerFeesCount
) {

    /** @param terPercent null for a share, a coin, or a fund no source has a TER for */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Line(String ticker, String name, BigDecimal valueEur, BigDecimal terPercent) {}
}
