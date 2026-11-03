package com.picsou.dto;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The indices the performance chart can be compared with, each tracked by a EUR-quoted UCITS ETF
 * the Yahoo adapter prices daily. A whitelist on purpose, and the only list of these tickers:
 * the price jobs read it to keep the series filled, and no request ever names a ticker.
 */
public enum BenchmarkKey {
    MSCI_WORLD("IWDA.AS", "MSCI World"),
    SP500("SXR8.DE", "S&P 500"),
    CAC40("C40.PA", "CAC 40");

    private final String ticker;
    private final String label;

    BenchmarkKey(String ticker, String label) {
        this.ticker = ticker;
        this.label = label;
    }

    public String ticker() {
        return ticker;
    }

    public String label() {
        return label;
    }

    /** Every benchmark ticker, for the jobs that keep their {@code price_snapshot} rows current. */
    public static Set<String> tickers() {
        return Arrays.stream(values()).map(BenchmarkKey::ticker).collect(Collectors.toUnmodifiableSet());
    }
}
