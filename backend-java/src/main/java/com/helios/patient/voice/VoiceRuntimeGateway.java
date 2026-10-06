package com.helios.patient.voice;

import java.time.Instant;

/**
 * Server-side authority boundary between HELIOS Spring and the realtime voice
 * runtime. Browser clients never receive the runtime control credential.
 */
public interface VoiceRuntimeGateway {

    RuntimeAccess prepare(String voiceSessionId, String patientSessionId);

    default void queueQuestion(String voiceSessionId, String questionId, String text) {
        // Test/dummy gateways may omit control-plane delivery.
    }

    record RuntimeAccess(
            boolean available,
            String transport,
            String websocketUrl,
            String credential,
            Instant expiresAt,
            String detail) {

        static RuntimeAccess unavailable(String detail) {
            return new RuntimeAccess(
                    false,
                    "PENDING_PHASE4_BENCHMARK",
                    null,
                    null,
                    null,
                    detail);
        }
    }
}
