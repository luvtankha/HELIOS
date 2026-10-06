package com.helios.patient.config;

import java.net.InetSocketAddress;
import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;

import reactor.core.publisher.Mono;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class ApiRateLimitFilter implements WebFilter {

    private static final long WINDOW_MILLIS = 60_000;
    private static final int MAX_TRACKED_CLIENTS = 20_000;

    private final int requestsPerMinute;
    private final Clock clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong lastCleanup = new AtomicLong();

    @Autowired
    public ApiRateLimitFilter(
            @Value("${helios.security.requests-per-minute:120}") int requestsPerMinute) {
        this(requestsPerMinute, Clock.systemUTC());
    }

    ApiRateLimitFilter(int requestsPerMinute, Clock clock) {
        if (requestsPerMinute < 10 || requestsPerMinute > 10_000) {
            throw new IllegalArgumentException("requests-per-minute must be between 10 and 10000");
        }
        this.requestsPerMinute = requestsPerMinute;
        this.clock = clock;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        if (!path.startsWith("/api/v2/") || "OPTIONS".equals(exchange.getRequest().getMethod().name())) {
            return chain.filter(exchange);
        }

        long now = clock.millis();
        cleanup(now);
        String key = clientKey(exchange);
        Window window = windows.compute(key, (ignored, current) -> {
            if (current == null || now - current.startedAt >= WINDOW_MILLIS) {
                return new Window(now, 1);
            }
            return new Window(current.startedAt, current.count + 1);
        });
        if (window.count > requestsPerMinute) {
            exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
            exchange.getResponse().getHeaders().set("Retry-After", "60");
            return exchange.getResponse().setComplete();
        }
        return chain.filter(exchange);
    }

    private void cleanup(long now) {
        long previous = lastCleanup.get();
        if (now - previous < WINDOW_MILLIS || !lastCleanup.compareAndSet(previous, now)) {
            return;
        }
        windows.entrySet().removeIf(entry -> now - entry.getValue().startedAt >= WINDOW_MILLIS);
        if (windows.size() > MAX_TRACKED_CLIENTS) {
            windows.clear();
        }
    }

    private static String clientKey(ServerWebExchange exchange) {
        InetSocketAddress remote = exchange.getRequest().getRemoteAddress();
        if (remote == null || remote.getAddress() == null) return "unknown";
        return remote.getAddress().getHostAddress();
    }

    private record Window(long startedAt, int count) {}
}
