package com.picsou.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Time- and money-weighted performance of the member's investment accounts.
 *
 * <p>{@code ALWAYS}: a metric that cannot be measured is sent as {@code null}, not omitted, so
 * the client never has to tell a missing key from a missing value.
 *
 * @param investedEur null only when a Caisse d'Epargne PER has no complete cost basis
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record PerformanceResponse(
    LocalDate from,
    LocalDate to,
    BigDecimal valueEur,
    BigDecimal investedEur,
    Double twrPercent,
    Double annualizedPercent,
    Double xirrPercent,
    Double volatilityPercent,
    Double maxDrawdownPercent,
    LocalDate maxDrawdownFrom,
    LocalDate maxDrawdownTo,
    List<Point> points
) {

    /** @param investedEur null on a day whose cost basis is unknown (see above) */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Point(LocalDate date, BigDecimal valueEur, BigDecimal investedEur, double index) {}
}
