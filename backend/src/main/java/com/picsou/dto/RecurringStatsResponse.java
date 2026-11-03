package com.picsou.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * What a recurring investment plan actually bought over its window (the last 12 calendar months,
 * intersected with the plan's own dates). Amounts are weighted by the member's ownership share.
 * {@code currentValueEur} and {@code gain*} are null when a bought ticker has no price;
 * {@code gain*} are also null when nothing was bought.
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record RecurringStatsResponse(
    LocalDate from,
    LocalDate to,
    BigDecimal investedEur,
    int purchases,
    int monthsWithPurchase,
    int monthsElapsed,
    BigDecimal currentValueEur,
    BigDecimal gainEur,
    BigDecimal gainPercent
) {}
