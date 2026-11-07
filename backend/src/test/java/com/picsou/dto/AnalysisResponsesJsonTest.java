package com.picsou.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The application drops nulls globally ({@code default-property-inclusion: non_null}); the
 * analysis contract sends them. This pins the override against the same global setting.
 */
class AnalysisResponsesJsonTest {

    private final ObjectMapper mapper = new ObjectMapper()
        .findAndRegisterModules()
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
        .setSerializationInclusion(JsonInclude.Include.NON_NULL);

    @Test
    void performanceSendsItsNullMetrics() throws Exception {
        LocalDate day = LocalDate.of(2026, 11, 3);
        String json = mapper.writeValueAsString(new PerformanceResponse(day, day, BigDecimal.ZERO, null,
            null, null, null, null, null, null, null,
            List.of(new PerformanceResponse.Point(day, BigDecimal.ONE, null, 100.0))));

        assertThat(json).contains("\"from\":\"2026-11-03\"", "\"investedEur\":null", "\"twrPercent\":null",
            "\"maxDrawdownFrom\":null", "\"index\":100.0");
    }

    @Test
    void feesSendsItsNullTer() throws Exception {
        LocalDate day = LocalDate.of(2026, 11, 3);
        String json = mapper.writeValueAsString(new FeesResponse(day, day, null, null, BigDecimal.ZERO,
            BigDecimal.ONE, List.of(new FeesResponse.Line("AAPL", "Apple", BigDecimal.ONE, null)),
            BigDecimal.ZERO, 0));

        assertThat(json).contains("\"weightedTerPercent\":null", "\"annualCostEur\":null", "\"terPercent\":null");
    }
}
