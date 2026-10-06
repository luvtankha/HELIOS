package com.helios.patient.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetSocketAddress;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

import reactor.core.publisher.Mono;

class ApiRateLimitFilterTest {

    @Test
    void limitsV2TrafficPerClientButDoesNotAffectActuator() {
        var filter = new ApiRateLimitFilter(
                10,
                Clock.fixed(Instant.parse("2026-10-04T00:00:00Z"), ZoneOffset.UTC));
        AtomicInteger accepted = new AtomicInteger();

        for (int index = 0; index < 10; index++) {
            var exchange = exchange("/api/v2/patient-sessions");
            filter.filter(exchange, ignored -> {
                accepted.incrementAndGet();
                return Mono.empty();
            }).block();
            assertThat(exchange.getResponse().getStatusCode()).isNull();
        }

        var blocked = exchange("/api/v2/patient-sessions");
        filter.filter(blocked, ignored -> Mono.empty()).block();
        assertThat(blocked.getResponse().getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(blocked.getResponse().getHeaders().getFirst("Retry-After")).isEqualTo("60");
        assertThat(accepted).hasValue(10);

        var actuator = exchange("/actuator/health");
        filter.filter(actuator, ignored -> {
            accepted.incrementAndGet();
            return Mono.empty();
        }).block();
        assertThat(actuator.getResponse().getStatusCode()).isNull();
        assertThat(accepted).hasValue(11);
    }

    private static MockServerWebExchange exchange(String path) {
        return MockServerWebExchange.from(
                MockServerHttpRequest.get(path)
                        .remoteAddress(new InetSocketAddress("127.0.0.1", 50000))
                        .build());
    }
}
