package com.picsou.adapter;

import com.picsou.exception.SyncException;
import com.picsou.port.CryptoExchangePort.ExchangePosition;
import com.picsou.port.CryptoExchangePort.Product;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeFunction;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

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

        assertThatThrownBy(() -> adapter.fetchPositions("key", "secret"))
            .isInstanceOf(WebClientResponseException.BadRequest.class);
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

    private BinanceAdapter adapterRouting(Function<String, Mono<ClientResponse>> route) {
        ExchangeFunction exchange = request -> {
            requests.add(request);
            return route.apply(request.url().getPath());
        };
        return new BinanceAdapter(
            WebClient.builder().baseUrl("https://api.binance.test").exchangeFunction(exchange).build());
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
