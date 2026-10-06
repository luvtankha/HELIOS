package com.helios.patient.voice;

import java.time.Clock;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Service;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

@Service
public class VoiceEventStreamService {
    private final Map<String, Channel> channels = new ConcurrentHashMap<>();
    private final Clock clock;

    public VoiceEventStreamService() {
        this(Clock.systemUTC());
    }

    VoiceEventStreamService(Clock clock) {
        this.clock = clock;
    }

    public void open(String voiceSessionId) {
        channels.computeIfAbsent(voiceSessionId, ignored -> new Channel());
    }

    public Flux<VoiceUiEvent> stream(String voiceSessionId, long afterSequence) {
        if (afterSequence < 0) throw new IllegalArgumentException("afterSequence must be non-negative");
        return channels.computeIfAbsent(voiceSessionId, ignored -> new Channel())
                .sink().asFlux().filter(event -> event.sequence() > afterSequence);
    }

    public VoiceUiEvent publish(String voiceSessionId, VoiceUiEventType type, Map<String, Object> payload) {
        Channel channel = channels.computeIfAbsent(voiceSessionId, ignored -> new Channel());
        var event = new VoiceUiEvent(
                UUID.randomUUID().toString(), voiceSessionId, channel.sequence().incrementAndGet(),
                type.wireName(), clock.instant(), payload == null ? Map.of() : Map.copyOf(payload));
        channel.sink().tryEmitNext(event);
        return event;
    }

    public void close(String voiceSessionId, String reason) {
        Channel channel = channels.get(voiceSessionId);
        if (channel == null) return;
        publish(voiceSessionId, VoiceUiEventType.SESSION_ENDED,
                reason == null || reason.isBlank() ? Map.of() : Map.of("reason", reason));
        channel.sink().tryEmitComplete();
    }

    private record Channel(AtomicLong sequence, Sinks.Many<VoiceUiEvent> sink) {
        Channel() {
            // Bounded replay allows reconnecting clients to request events after
            // their last acknowledged sequence without replaying media/audio.
            this(new AtomicLong(), Sinks.many().replay().limit(256));
        }
    }
}
