package com.picsou.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Expense totals grouped by merchant over the same span and with the same exclusions as
 * {@link SpendingByCategoryResponse}. {@code total} is every expense of the span, not only the
 * listed merchants; {@code share} is a percentage of it (0–100), unlike the by-category fraction.
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record MerchantSpendingResponse(
    LocalDate from,
    LocalDate to,
    BigDecimal total,
    List<MerchantSpend> merchants
) {
    /**
     * {@code key} is {@code brand:<id>} for a recognised brand, else {@code label:<match key>} of the
     * merchant label (or of the cleaned counterparty / description). {@code logoUrl} is the opt-in
     * brand logo proxy, null when logos are off or the brand has none.
     */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record MerchantSpend(
        String key,
        String label,
        String logoUrl,
        BigDecimal amount,
        int count,
        BigDecimal share
    ) {}
}
