// Synthetic local API integration checks; no secrets or patient values are printed.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
if (process.env.HELIOS_LOCAL_DATABASE !== "true")
  throw new Error("Local test profile required");
const base = "http://127.0.0.1:8080";
const results = [];
async function request(path, method = "GET", data, token, internal = false) {
  return fetch(base + path, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-session-token": token } : {}),
      ...(internal
        ? { Authorization: `Bearer ${process.env.HELIOS_VOICE_CONTROL_SECRET}` }
        : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
function pass(name) {
  results.push({ test: name, status: "PASS" });
}
try {
  assert.equal(
    (
      await request("/api/v2/patient-sessions", "POST", {
        conversationLanguage: "invalid",
      })
    ).status,
    400,
  );
  pass("invalid language rejected");
  const created = await request("/api/v2/patient-sessions", "POST", {
    conversationLanguage: "hi-Hinglish",
  });
  assert.equal(created.status, 201);
  const session = await created.json();
  assert.ok(
    [401, 403].includes(
      (await request(`/api/v2/patient-sessions/${session.sessionId}`)).status,
    ),
  );
  pass("anonymous patient access denied");
  const consentBody = {
    sessionId: session.sessionId,
    consentType: "PRE_CONSULTATION",
    accepted: true,
    version: "1.0",
  };
  const consents = await Promise.all(
    [1, 2].map(() =>
      request("/api/v2/consents", "POST", consentBody, session.sessionToken),
    ),
  );
  assert.ok(consents.every((response) => response.ok));
  pass("concurrent consent requests remain valid");
  const voiceBody = {
    patientSessionId: session.sessionId,
    capabilities: { languageMode: "hi-Hinglish", bargeIn: true },
  };
  const responses = await Promise.all(
    [1, 2, 3].map(() =>
      request(
        "/api/v2/voice-sessions",
        "POST",
        voiceBody,
        session.sessionToken,
      ),
    ),
  );
  assert.ok(responses.every((response) => response.ok));
  const voices = await Promise.all(
    responses.map((response) => response.json()),
  );
  assert.equal(new Set(voices.map((voice) => voice.voiceSessionId)).size, 1);
  const voiceId = voices[0].voiceSessionId;
  pass("three concurrent voice starts reuse one session");
  const invalidVisit = await request(
    "/api/v2/voice-sessions",
    "POST",
    { ...voiceBody, visitId: "other-patients-visit" },
    session.sessionToken,
  );
  assert.ok([400, 403, 409].includes(invalidVisit.status));
  pass("foreign visit association rejected");
  const body = {
    patientSessionId: session.sessionId,
    voiceSessionId: "wrong-voice",
    identity: [],
    facts: [],
  };
  assert.equal(
    (
      await request(
        "/internal/v2/voice-runtime/turn",
        "POST",
        body,
        undefined,
        true,
      )
    ).status,
    409,
  );
  pass("mismatched runtime session rejected");
  assert.equal(
    (
      await request(
        `/api/v2/voice-sessions/${voiceId}`,
        "DELETE",
        undefined,
        session.sessionToken,
      )
    ).status,
    204,
  );
  assert.equal(
    (
      await request(
        `/api/v2/voice-sessions/${voiceId}/resume`,
        "POST",
        { lastAcknowledgedSequence: 0 },
        session.sessionToken,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        `/internal/v2/voice-runtime/context?patientSessionId=${session.sessionId}&voiceSessionId=${voiceId}`,
        "GET",
        undefined,
        undefined,
        true,
      )
    ).status,
    409,
  );
  pass("closed voice cannot resume or open provider context");
  const after = await request(
    `/api/v2/voice-sessions/${voiceId}`,
    "GET",
    undefined,
    session.sessionToken,
  );
  assert.ok(after.ok);
  assert.equal((await after.json()).media.available, false);
  pass("closed session does not mint active media credentials");
} catch (error) {
  results.push({
    test: "edge-case suite",
    status: "FAIL",
    errorType: error.constructor.name,
  });
  process.exitCode = 1;
  console.error(error.message); // assertion values contain only status codes/booleans
} finally {
  writeFileSync(
    ".local/patient-edge-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
}
