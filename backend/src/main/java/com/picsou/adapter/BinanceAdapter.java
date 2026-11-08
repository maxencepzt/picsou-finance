package com.picsou.adapter;

import com.fasterxml.jackson.databind.JsonNode;
import com.picsou.exception.SyncException;
import com.picsou.port.CryptoExchangePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

@Component
public class BinanceAdapter implements CryptoExchangePort {

    private static final Logger log = LoggerFactory.getLogger(BinanceAdapter.class);
    private static final String BASE_URL = "https://api.binance.com";
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    /** Simple Earn position endpoints cap a page at 100 rows. */
    private static final int EARN_PAGE_SIZE = 100;

    private final WebClient webClient;

    public BinanceAdapter() {
        this(WebClient.builder().baseUrl(BASE_URL).build());
    }

    // Package-private for tests — inject a WebClient backed by an ExchangeFunction.
    BinanceAdapter(WebClient webClient) {
        this.webClient = webClient;
    }

    @Override
    public String exchangeName() {
        return "BINANCE";
    }

    /**
     * Spot balances plus Simple Earn: flexible products as {@link Product#LENDING}, locked ones
     * as {@link Product#STAKING}. {@code /api/v3/account} does not include what sits in Earn, so
     * reading spot alone undercounts any account that has placed coins there.
     *
     * <p>All or nothing: a failed Earn call fails the sync rather than returning spot alone,
     * which would write a balance short by the whole Earn amount into the daily snapshot.
     */
    @Override
    public List<ExchangePosition> fetchPositions(String apiKey, String apiSecret) {
        JsonNode response = signedGet("/api/v3/account", "", apiKey, apiSecret);

        List<ExchangePosition> holdings = new ArrayList<>();
        JsonNode balances = response.path("balances");
        if (balances.isArray()) {
            for (JsonNode balance : balances) {
                String asset = balance.path("asset").asText("");
                BigDecimal free = new BigDecimal(balance.path("free").asText("0"));
                BigDecimal locked = new BigDecimal(balance.path("locked").asText("0"));
                BigDecimal total = free.add(locked);
                if (total.compareTo(BigDecimal.ZERO) > 0) {
                    holdings.add(ExchangePosition.spot(asset.toUpperCase(), total));
                }
            }
        }

        List<ExchangePosition> flexible = earnPositions(
            "/sapi/v1/simple-earn/flexible/position", "totalAmount", Product.LENDING, apiKey, apiSecret);
        // Spot may also list flexible Earn as an LD-prefixed asset (LDUSDT for USDT in Flexible).
        // Drop it only when the matching flexible position exists: a bare startsWith("LD") would
        // also drop real coins such as LDO.
        Set<String> mirrored = new HashSet<>();
        flexible.forEach(position -> mirrored.add("LD" + position.symbol()));
        holdings.removeIf(position -> mirrored.contains(position.symbol()));
        holdings.addAll(flexible);
        holdings.addAll(earnPositions(
            "/sapi/v1/simple-earn/locked/position", "amount", Product.STAKING, apiKey, apiSecret));

        log.info("Binance: fetched {} non-zero positions across spot and Simple Earn", holdings.size());
        return holdings;
    }

    /**
     * Every page of one Simple Earn position list, summed per asset: several locked positions in
     * the same coin (different durations) are one line, as the position table is unique on
     * (account, product, ticker).
     */
    private List<ExchangePosition> earnPositions(
        String path, String amountField, Product product, String apiKey, String apiSecret
    ) {
        Map<String, BigDecimal> perAsset = new TreeMap<>();
        int read = 0;
        for (int page = 1; ; page++) {
            JsonNode body = signedGet(path, "current=" + page + "&size=" + EARN_PAGE_SIZE, apiKey, apiSecret);
            JsonNode rows = body.path("rows");
            if (!rows.isArray() || rows.isEmpty()) break;
            for (JsonNode row : rows) {
                BigDecimal amount = new BigDecimal(row.path(amountField).asText("0"));
                if (amount.signum() > 0) {
                    perAsset.merge(row.path("asset").asText("").toUpperCase(), amount, BigDecimal::add);
                }
            }
            read += rows.size();
            // Without total, stopping here could return the first page only: a short list the
            // caller would write into the snapshot.
            if (!body.path("total").canConvertToInt()) {
                throw new SyncException("Binance returned no row count for " + path + ".");
            }
            if (read >= body.path("total").asInt()) break;
        }
        List<ExchangePosition> positions = new ArrayList<>();
        perAsset.forEach((asset, quantity) ->
            positions.add(new ExchangePosition(product, asset, quantity, null, null)));
        return positions;
    }

    /**
     * One signed GET. Never returns null: an empty body read as "no coins" would write a EUR 0
     * cliff into the net-worth history (CryptoExchangePort#fetchPositions).
     */
    private JsonNode signedGet(String path, String params, String apiKey, String apiSecret) {
        String queryString = (params.isEmpty() ? "" : params + "&") + "timestamp=" + System.currentTimeMillis();
        String signature = hmacSha256(apiSecret, queryString);
        JsonNode response = webClient.get()
            .uri(uriBuilder -> uriBuilder
                .path(path)
                .query(queryString + "&signature=" + signature)
                .build())
            .header("X-MBX-APIKEY", apiKey)
            .retrieve()
            .bodyToMono(JsonNode.class)
            .timeout(TIMEOUT)
            .block();
        if (response == null) {
            throw new SyncException("Binance returned an empty response for " + path + ".");
        }
        return response;
    }

    @Override
    public boolean testConnection(String apiKey, String apiSecret) {
        try {
            signedGet("/api/v3/account", "", apiKey, apiSecret);
            return true;
        } catch (Exception ex) {
            log.warn("Binance connection test failed: {}", ex.getMessage());
            return false;
        }
    }

    private String hmacSha256(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new RuntimeException("HMAC-SHA256 signing failed", ex);
        }
    }
}
