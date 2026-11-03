package com.picsou.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Day-over-day move of each held security, from its two most recent {@code price_snapshot} days.
 * {@code date} / {@code previousDate} are the newest of those days across the compared lines, and
 * both are null when no held ticker has two snapshots. The app serialises with {@code non_null};
 * the contract wants explicit nulls, hence {@code ALWAYS}.
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record MoversResponse(
    LocalDate date,
    LocalDate previousDate,
    List<Mover> gainers,
    List<Mover> losers
) {
    /**
     * One security merged across the member's accounts. {@code valueEur} and {@code valueChangeEur}
     * use the quantity weighted by the member's ownership share; {@code logoUrl} is the stored mark,
     * null when none is stored (always null for crypto).
     */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Mover(
        String ticker,
        String name,
        String logoUrl,
        BigDecimal priceEur,
        BigDecimal previousPriceEur,
        BigDecimal changePercent,
        BigDecimal valueEur,
        BigDecimal valueChangeEur
    ) {}
}
