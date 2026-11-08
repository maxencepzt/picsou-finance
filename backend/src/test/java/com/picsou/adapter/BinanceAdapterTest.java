package com.picsou.adapter;

import com.picsou.exception.SyncException;
import com.picsou.port.CryptoExchangePort;
import com.picsou.port.CryptoExchangePort.ExchangePosition;
import com.picsou.port.CryptoExchangePort.Product;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeFunction;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

/**
 * Binance positions: spot from {@code /api/v3/account}, plus Simple Earn, which that endpoint
 * does not include. Reading spot alone undercounted every account with coins placed in Earn.
 */
class BinanceAdapterTest {

    private static final String SPOT = """
        {"balances":[
          {"asset":"ETH","free":"0.5","locked":"0.1"},
          {"asset":"LDUSDT","free":"75.46","locked":"0"},
          {"asset":"LDO","free":"3","locked":"0"},
          {"asset":"BNB","free":"0","locked":"0"}
        ]}""";
    private static final String NO_ROWS = "{\"rows\":[],\"total\":0}";

    private static final Clock NOW = Clock.fixed(Instant.parse("2026-11-08T12:00:00Z"), ZoneOffset.UTC);

    private final List<ClientRequest> requests = new ArrayList<>();

    @Test
    void fetchPositions_addsSimpleEarnToSpot_oneLinePerProductAndAsset() {
        BinanceAdapter adapter = adapterRouting(path -> switch (path) {
            case "/api/v3/account" -> ok(SPOT);
            case "/sapi/v1/simple-earn/flexible/position" -> ok("""
                {"rows":[{"asset":"USDT","totalAmount":"75.46"},{"asset":"ETH","totalAmount":"0.2"}],
                 "total":2}""");
            // Two locked positions in the same coin (different durations) are one line: the
            // position table is unique on (account, product, ticker).
            case "/sapi/v1/simple-earn/locked/position" -> ok("""
                {"rows":[{"asset":"EGLD","amount":"1.5"},{"asset":"EGLD","amount":"0.5"},
                         {"asset":"AVAX","amount":"0"}],
                 "total":3}""");
            default -> notFound();
        });

        List<ExchangePosition> positions = adapter.fetchPositions("key", "secret");

        // LDUSDT is spot's mirror of the flexible USDT position and is dropped; LDO (Lido) is a
        // real coin with no flexible counterpart and stays.
        assertThat(positions)
            .extracting(ExchangePosition::product, ExchangePosition::symbol, p -> p.quantity().toPlainString())
            .containsExactly(
                tuple(Product.SPOT, "ETH", "0.6"),
                tuple(Product.SPOT, "LDO", "3"),
                tuple(Product.LENDING, "ETH", "0.2"),
                tuple(Product.LENDING, "USDT", "75.46"),
                tuple(Product.STAKING, "EGLD", "2.0"));
        // Binance reports no principal/interest split for these products.
        assertThat(positions).allSatisfy(p -> assertThat(p.principal()).isNull());
        assertThat(requests).allSatisfy(request -> {
            assertThat(request.headers().getFirst("X-MBX-APIKEY")).isEqualTo("key");
            assertThat(request.url().getQuery()).contains("timestamp=").contains("signature=");
        });
    }

    @Test
    void fetchPositions_readsEveryPageOfAnEarnList() {
        BinanceAdapter adapter = adapterRouting(path -> switch (path) {
            case "/api/v3/account" -> ok("{\"balances\":[]}");
            case "/sapi/v1/simple-earn/flexible/position" -> ok(
                requests.getLast().url().getQuery().contains("current=1&")
                    ? "{\"rows\":[{\"asset\":\"USDT\",\"totalAmount\":\"10\"}],\"total\":2}"
                    : "{\"rows\":[{\"asset\":\"USDT\",\"totalAmount\":\"5\"}],\"total\":2}");
            case "/sapi/v1/simple-earn/locked/position" -> ok(NO_ROWS);
            default -> notFound();
        });

        List<ExchangePosition> positions = adapter.fetchPositions("key", "secret");

        assertThat(positions).singleElement()
            .satisfies(p -> assertThat(p.quantity()).isEqualByComparingTo("15"));
        assertThat(requests).filteredOn(r -> r.url().getPath().endsWith("flexible/position"))
            .extracting(r -> r.url().getQuery().replaceAll("&timestamp=.*", ""))
            .containsExactly("current=1&size=100", "current=2&size=100");
    }

    @Test
    void fetchPositions_failsWholeWhenEarnCannotBeRead() {
        // Returning spot alone would write a balance short by the whole Earn amount into the
        // daily snapshot.
        BinanceAdapter adapter = adapterRouting(path -> switch (path) {
            case "/api/v3/account" -> ok(SPOT);
            case "/sapi/v1/simple-earn/flexible/position" -> ok(NO_ROWS);
            default -> Mono.just(ClientResponse.create(HttpStatus.BAD_REQUEST)
                .header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .body("{\"code\":-1002,\"msg\":\"unauthorized\"}").build());
        });

        // Binance's own explanation is kept: a bare 400 says nothing about what it rejected.
        assertThatThrownBy(() -> adapter.fetchPositions("key", "secret"))
            .isInstanceOf(SyncException.class)
            .hasMessageContaining("400")
            .hasMessageContaining("locked/position")
            .hasMessageContaining("-1002");
    }

    @Test
    void fetchPositions_failsRatherThanStopAtOnePageWhenTheRowCountIsMissing() {
        BinanceAdapter adapter = adapterRouting(path -> switch (path) {
            case "/api/v3/account" -> ok("{\"balances\":[]}");
            case "/sapi/v1/simple-earn/flexible/position" -> ok("{\"rows\":[{\"asset\":\"USDT\",\"totalAmount\":\"10\"}]}");
            default -> ok(NO_ROWS);
        });

        assertThatThrownBy(() -> adapter.fetchPositions("key", "secret"))
            .isInstanceOf(SyncException.class)
            .hasMessageContaining("flexible/position");
    }

    @Test
    void fetchRewards_readsEveryRewardHistoryInWindowsUnderThreeMonths() {
        BinanceAdapter adapter = adapterRouting(path -> {
            String query = requests.getLast().url().getQuery();
            boolean firstWindow = query.contains("startTime=" + Instant.parse("2026-06-01T00:00:00Z").toEpochMilli());
            if (!firstWindow) return ok(NO_ROWS);
            return switch (path) {
                case "/sapi/v1/simple-earn/flexible/history/rewardsRecord" -> ok(query.contains("type=BONUS")
                    ? "{\"rows\":[{\"asset\":\"usdt\",\"rewards\":\"0.01\",\"type\":\"BONUS\",\"time\":1751328000000}],\"total\":1}"
                    : "{\"rows\":[{\"asset\":\"USDT\",\"rewards\":\"0.02\",\"type\":\"REALTIME\",\"time\":1751328000000}],\"total\":1}");
                case "/sapi/v1/simple-earn/locked/history/rewardsRecord" ->
                    ok("{\"rows\":[{\"asset\":\"EGLD\",\"amount\":\"0.003\",\"time\":1751414400000}],\"total\":1}");
                case "/sapi/v1/eth-staking/eth/history/rewardsHistory" ->
                    ok("{\"rows\":[{\"asset\":\"BETH\",\"amount\":\"0.0001\",\"time\":1751414400000},"
                        + "{\"asset\":\"WBETH\",\"amount\":\"0\",\"time\":1751414400000}],\"total\":2}");
                default -> notFound();
            };
        });

        List<CryptoExchangePort.ExchangeReward> rewards =
            adapter.fetchRewards("key", "secret", Instant.parse("2026-06-01T00:00:00Z"));

        // A zero credit is no reward; the asset is upper-cased like the positions, and staked-ETH
        // receipts (BETH, WBETH) count as ETH, as the history import keyed them.
        assertThat(rewards)
            .extracting(CryptoExchangePort.ExchangeReward::asset, r -> r.amount().toPlainString(),
                CryptoExchangePort.ExchangeReward::time)
            .containsExactly(
                tuple("USDT", "0.01", Instant.ofEpochMilli(1751328000000L)),
                tuple("USDT", "0.02", Instant.ofEpochMilli(1751328000000L)),
                tuple("EGLD", "0.003", Instant.ofEpochMilli(1751414400000L)),
                tuple("ETH", "0.0001", Instant.ofEpochMilli(1751414400000L)));
        // Two windows of at most 89 days cover 2026-06-01 to now without touching: Binance ranges
        // include both ends, so a credit stamped on a shared boundary would be read twice.
        List<String> ranges = requests.stream()
            .filter(r -> r.url().getPath().endsWith("locked/history/rewardsRecord"))
            .map(r -> r.url().getQuery().replaceAll(".*(startTime=\\d+&endTime=\\d+).*", "$1"))
            .toList();
        assertThat(ranges).containsExactly(
            "startTime=" + Instant.parse("2026-06-01T00:00:00Z").toEpochMilli()
                + "&endTime=" + (Instant.parse("2026-08-29T00:00:00Z").toEpochMilli() - 1),
            "startTime=" + Instant.parse("2026-08-29T00:00:00Z").toEpochMilli()
                + "&endTime=" + Instant.parse("2026-11-08T12:00:00Z").toEpochMilli());
        assertThat(requests).hasSize(8);
    }

    private BinanceAdapter adapterRouting(Function<String, Mono<ClientResponse>> route) {
        ExchangeFunction exchange = request -> {
            requests.add(request);
            return route.apply(request.url().getPath());
        };
        return new BinanceAdapter(
            WebClient.builder().baseUrl("https://api.binance.test").exchangeFunction(exchange).build(), NOW);
    }

    private static Mono<ClientResponse> ok(String body) {
        return Mono.just(ClientResponse.create(HttpStatus.OK)
            .header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
            .body(body).build());
    }

    private static Mono<ClientResponse> notFound() {
        return Mono.just(ClientResponse.create(HttpStatus.NOT_FOUND).build());
    }
}
