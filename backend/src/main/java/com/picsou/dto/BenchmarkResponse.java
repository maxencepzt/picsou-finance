package com.picsou.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Daily EUR closes of a benchmark ETF, oldest first. */
public record BenchmarkResponse(BenchmarkKey key, String ticker, String label, List<Point> points) {

    public record Point(LocalDate date, BigDecimal priceEur) {}
}
