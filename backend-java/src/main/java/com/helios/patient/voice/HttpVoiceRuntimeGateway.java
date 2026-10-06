package com.helios.patient.voice;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Collection;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import tools.jackson.databind.json.JsonMapper;

@Component
public class HttpVoiceRuntimeGateway implements VoiceRuntimeGateway {

    private final URI runtimeUri;
    private final URI publicUri;
    private final boolean requireBenchmarkApproval;
    private final String controlSecret;
    private final VoiceRuntimeTicketIssuer ticketIssuer;
    private final HttpClient httpClient;
    private final JsonMapper jsonMapper;

    @Autowired
    public HttpVoiceRuntimeGateway(
            @Value("${helios.voice.runtime-uri:http://localhost:9090}") String runtimeUri,
            @Value("${helios.voice.public-uri:http://localhost:9090}") String publicUri,
            @Value("${helios.voice.require-benchmark-approval:true}") boolean requireBenchmarkApproval,
            @Value("${helios.voice.control-secret:}") String controlSecret,
            VoiceRuntimeTicketIssuer ticketIssuer,
            JsonMapper jsonMapper) {
        this(
                URI.create(stripTrailingSlash(runtimeUri)),
                URI.create(stripTrailingSlash(publicUri)),
                requireBenchmarkApproval,
                controlSecret,
                ticketIssuer,
                HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1)
                        .connectTimeout(Duration.ofSeconds(2)).build(),
                jsonMapper);
    }

    HttpVoiceRuntimeGateway(
            URI runtimeUri,
            boolean requireBenchmarkApproval,
            String controlSecret,
            VoiceRuntimeTicketIssuer ticketIssuer,
            HttpClient httpClient,
            JsonMapper jsonMapper) {
        this(runtimeUri, runtimeUri, requireBenchmarkApproval, controlSecret, ticketIssuer, httpClient, jsonMapper);
    }

    HttpVoiceRuntimeGateway(
            URI runtimeUri, URI publicUri, boolean requireBenchmarkApproval, String controlSecret,
            VoiceRuntimeTicketIssuer ticketIssuer, HttpClient httpClient, JsonMapper jsonMapper) {
        this.runtimeUri = runtimeUri;
        this.publicUri = publicUri;
        this.requireBenchmarkApproval = requireBenchmarkApproval;
        this.controlSecret = controlSecret == null ? "" : controlSecret;
        this.ticketIssuer = ticketIssuer;
        this.httpClient = httpClient;
        this.jsonMapper = jsonMapper;
    }

    @Override
    public RuntimeAccess prepare(String voiceSessionId, String patientSessionId) {
        if (!ticketIssuer.configured() || controlSecret.isBlank()) {
            return RuntimeAccess.unavailable("Voice runtime security credentials are not fully configured.");
        }
        RuntimeCapabilities capabilities = capabilities();
        if (!capabilities.ready(requireBenchmarkApproval)) {
            return RuntimeAccess.unavailable(capabilities.detail());
        }
        VoiceRuntimeTicketIssuer.Ticket ticket = ticketIssuer.issue(voiceSessionId, patientSessionId);
        return new RuntimeAccess(
                true,
                "WEBSOCKET_PCM16",
                websocketUri(publicUri).resolve("/v1/stream").toString(),
                ticket.credential(),
                ticket.expiresAt(),
                null);
    }

    @Override
    public void queueQuestion(String voiceSessionId, String questionId, String text) {
        if (controlSecret.isBlank()) {
            throw new IllegalStateException("voice runtime control secret is not configured");
        }
        try {
            String body = jsonMapper.writeValueAsString(Map.of(
                    "voiceSessionId", voiceSessionId,
                    "questionId", questionId,
                    "text", text));
            HttpRequest request = HttpRequest.newBuilder(runtimeUri.resolve("/v1/control/question"))
                    .timeout(Duration.ofSeconds(3))
                    .header("Authorization", "Bearer " + controlSecret)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 202) {
                throw new IllegalStateException(
                        "voice runtime rejected approved question with status " + response.statusCode());
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("voice runtime question delivery was interrupted", exception);
        } catch (Exception exception) {
            throw new IllegalStateException("voice runtime question delivery failed", exception);
        }
    }

    RuntimeCapabilities capabilities() {
        try {
            HttpRequest request = HttpRequest.newBuilder(runtimeUri.resolve("/v1/capabilities"))
                    .timeout(Duration.ofSeconds(3))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                return RuntimeCapabilities.unavailable("Voice runtime capability check failed.");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> body = jsonMapper.readValue(response.body(), Map.class);
            String state = stringValue(body.get("state"));
            boolean fullDuplex = Boolean.TRUE.equals(body.get("full_duplex"));
            boolean bargeIn = Boolean.TRUE.equals(body.get("barge_in"));
            boolean benchmarkApproved = Boolean.TRUE.equals(body.get("benchmark_approved"));
            boolean hinglish = collectionContains(body.get("languages"), "hi-Hinglish");
            String reason = stringValue(body.get("reason"));
            return new RuntimeCapabilities(
                    "ready".equalsIgnoreCase(state),
                    fullDuplex,
                    bargeIn,
                    hinglish,
                    benchmarkApproved,
                    reason == null || reason.isBlank()
                            ? "Voice runtime has not passed the required capability gate."
                            : reason);
        } catch (Exception exception) {
            return RuntimeCapabilities.unavailable("Voice runtime is unreachable.");
        }
    }

    private static boolean collectionContains(Object value, String expected) {
        if (!(value instanceof Collection<?> collection)) return false;
        return collection.stream().map(String::valueOf).anyMatch(expected::equals);
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static URI websocketUri(URI httpUri) {
        String scheme = switch (httpUri.getScheme()) {
            case "https" -> "wss";
            case "http" -> "ws";
            case "ws", "wss" -> httpUri.getScheme();
            default -> throw new IllegalArgumentException("voice runtime URI must use http(s) or ws(s)");
        };
        return URI.create(scheme + "://" + httpUri.getAuthority());
    }

    private static String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("voice runtime URI is required");
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    record RuntimeCapabilities(
            boolean runtimeReady,
            boolean fullDuplex,
            boolean bargeIn,
            boolean hinglish,
            boolean benchmarkApproved,
            String detail) {

        static RuntimeCapabilities unavailable(String detail) {
            return new RuntimeCapabilities(false, false, false, false, false, detail);
        }

        boolean ready(boolean requireBenchmarkApproval) {
            return runtimeReady
                    && fullDuplex
                    && bargeIn
                    && hinglish
                    && (!requireBenchmarkApproval || benchmarkApproved);
        }
    }
}
