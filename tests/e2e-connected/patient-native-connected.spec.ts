import { expect, test } from "@playwright/test";

test("native patient session and consent persist across browser refresh", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(error.message));

  // Exercise the real Java session/consent API and database without opening a
  // provider conversation or spending native-audio quota for this smoke test.
  await page.route("**/api/v2/voice-sessions", async (route) => {
    const { patientSessionId } = route.request().postDataJSON();
    await route.fulfill({
      json: {
        voiceSessionId: "synthetic-unavailable-voice",
        patientSessionId,
        visitId: null,
        state: "CONNECTING",
        media: {
          available: false,
          transport: "WEBSOCKET_PCM16",
          websocketUrl: null,
          credential: null,
          expiresAt: null,
          detail: "Provider media excluded from connected consent smoke test",
        },
        conversation: {
          languageMode: "hi-Hinglish",
          doctorAvatarId: "lead-general",
          bargeIn: true,
        },
        lastAcknowledgedSequence: 0,
        createdAt: new Date().toISOString(),
      },
    });
  });
  await page.route("**/api/v2/voice-sessions/*/events**", (route) =>
    route.fulfill({ contentType: "application/x-ndjson", body: "" }),
  );

  const created = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v2/patient-sessions" &&
      response.request().method() === "POST",
  );
  await page.goto("/patient");
  const createdResponse = await created;
  expect(createdResponse.status()).toBe(201);
  const session = await createdResponse.json();
  expect(session.sessionId).toBeTruthy();
  expect(session.conversationLanguage).toBe("hi-Hinglish");
  expect(session.currentStep).toBe("CONSENT");

  const consentSaved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v2/consents" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "हाँ, मैं सहमत हूँ" }).click();
  const consentResponse = await consentSaved;
  expect(consentResponse.status()).toBe(201);
  expect(await consentResponse.json()).toMatchObject({
    sessionId: session.sessionId,
    accepted: true,
    consentType: "PRE_CONSULTATION",
  });
  await expect(
    page.getByText(
      "अभी आवाज़ से बातचीत उपलब्ध नहीं है। कृपया क्लिनिक के कर्मचारी से संपर्क करें।",
    ),
  ).toBeVisible();

  const resumed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/v2/patient-sessions/${session.sessionId}` &&
      response.request().method() === "GET",
  );
  await page.reload();
  const resumedResponse = await resumed;
  expect(resumedResponse.status()).toBe(200);
  expect(await resumedResponse.json()).toMatchObject({
    sessionId: session.sessionId,
    currentStep: "BASIC_INFO",
  });
  await expect(
    page.getByRole("button", { name: "हाँ, मैं सहमत हूँ" }),
  ).toHaveCount(0);
  expect(crashes).toEqual([]);
});
