import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectPartToMove(part: import("@playwright/test").Locator) {
  const initialTransform = await part.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await expect
    .poll(
      () => part.evaluate((element) => getComputedStyle(element).transform),
      { timeout: 900, intervals: [32, 64, 100] },
    )
    .not.toBe(initialTransform);
}

test("Hindi live consultation animates independent clinicians, reconnects, and completes", async ({
  page,
}) => {
  test.setTimeout(60000);
  let consent = false;
  let resumeRequests = 0;
  const session = () => ({
    sessionId: "synthetic-session",
    sessionToken: "synthetic-proof",
    status: "STARTED",
    currentStep: consent ? "BASIC_INFO" : "CONSENT",
    conversationLanguage: "hi-Hinglish",
    patientId: null,
    visitId: null,
    startedAt: "2026-10-04T00:00:00Z",
  });
  await page.route("**/api/v2/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/resume")) resumeRequests += 1;
    if (path === "/api/v2/consents") {
      consent = true;
      await route.fulfill({ json: {} });
    } else if (path.includes("patient-sessions"))
      await route.fulfill({ json: session() });
    else if (path.endsWith("/events"))
      await route.fulfill({ contentType: "application/x-ndjson", body: "" });
    else
      await route.fulfill({
        json: {
          voiceSessionId: "synthetic-voice",
          patientSessionId: "synthetic-session",
          visitId: null,
          state: "CONNECTING",
          media: {
            available: true,
            transport: "WEBSOCKET_PCM16",
            websocketUrl: "ws://localhost:9090/v1/stream",
            credential: resumeRequests
              ? "renewed-synthetic-ticket"
              : "synthetic-ticket",
            expiresAt: "2026-10-04T01:00:00Z",
            detail: null,
          },
          conversation: {
            languageMode: "hi-Hinglish",
            doctorAvatarId: "lead-general",
            bargeIn: true,
          },
          lastAcknowledgedSequence: 0,
          createdAt: "2026-10-04T00:00:00Z",
        },
      });
  });
  let nativeSocket: import("@playwright/test").WebSocketRoute | undefined;
  let connections = 0;
  const tickets: string[] = [];
  await page.routeWebSocket("ws://localhost:9090/v1/stream", (socket) => {
    nativeSocket = socket;
    connections += 1;
    socket.onMessage((message) => {
      if (typeof message === "string" && JSON.parse(message).type === "auth") {
        tickets.push(JSON.parse(message).ticket);
        socket.send(JSON.stringify({ type: "ready" }));
      }
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // Chromium's fake microphone emits a tone. Silence it so the real barge-in
  // detector does not interrupt the synthetic doctor's audio during UI checks.
  await page.addInitScript(() => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const microphone = await getUserMedia(constraints);
      const context = new AudioContext();
      const source = context.createMediaStreamSource(microphone);
      const mute = context.createGain();
      mute.gain.value = 0;
      const destination = context.createMediaStreamDestination();
      source.connect(mute).connect(destination);
      await context.resume();
      return destination.stream;
    };
  });
  await page.goto("/patient");
  await expect(
    page.getByRole("button", { name: "हाँ, मैं सहमत हूँ" }),
  ).toBeVisible();
  const scene = page.getByTestId("consultation-scene");
  const actors = scene.locator("button[data-clinician-id]");
  const actor = (id: string) =>
    scene.locator(`button[data-clinician-id="${id}"]`);
  const lead = actor("lead-general");
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("data-active-clinician", "lead-general");
  await expect(actors).toHaveCount(5);
  for (const id of [
    "lead-general",
    "clinician-female",
    "clinician-general",
    "clinician-surgical",
    "clinician-senior",
  ]) {
    await expect(actor(id)).toBeVisible();
    await expect(actor(id).locator("svg [data-part]").first()).toBeAttached();
  }
  await expect(lead).toHaveAttribute("data-active", "true");
  await expect(lead).toHaveAttribute("data-motion", "idle");

  // Supporting characters respond to people without overriding the clinical handoff.
  for (const [id, name] of [
    ["clinician-general", "डॉ. कबीर"],
    ["clinician-female", "डॉ. मीरा"],
    ["lead-general", "डॉ. आरव"],
    ["clinician-surgical", "डॉ. सना"],
    ["clinician-senior", "डॉ. अनन्या"],
  ] as const) {
    const clinician = actor(id);
    const box = await clinician.boundingBox();
    expect(box).not.toBeNull();
    // The face remains visible while another clinician's arm overlaps the torso.
    await clinician.click({
      position: { x: box!.width / 2, y: box!.height * 0.2 },
    });
    const tooltip = page.getByRole("tooltip").filter({ hasText: name });
    await expect(tooltip).toBeVisible();
    await expect(scene).toHaveAttribute("data-active-clinician", "lead-general");
    await clinician.focus();
    await expect(clinician).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(tooltip).not.toBeVisible();
  }
  await page.getByRole("button", { name: "हाँ, मैं सहमत हूँ" }).focus();
  await page.screenshot({ path: test.info().outputPath("hindi-consent.png") });
  await page.getByRole("button", { name: "हाँ, मैं सहमत हूँ" }).click();
  await expect.poll(() => Boolean(nativeSocket)).toBe(true);
  await expect(page.getByText("HELIOS आपकी बात सुन रहा है")).toBeAttached();
  await expect(lead).toHaveAttribute("data-motion", "listening");
  await expectPartToMove(lead.locator('svg [data-part="head"]'));
  await page.screenshot({ path: test.info().outputPath("hindi-listening.png") });
  nativeSocket!.send(
    JSON.stringify({
      type: "caption",
      text: "दर्द लगातार रहता है या बीच-बीच में आता है?",
    }),
  );
  nativeSocket!.send(Buffer.alloc(96000));
  await expect(
    page.getByText("दर्द लगातार रहता है या बीच-बीच में आता है?"),
  ).toBeVisible();
  await expect(lead).toHaveAttribute("data-motion", "speaking");
  await Promise.all([
    expectPartToMove(lead.locator('svg [data-part="gesture-arm"]')),
    expectPartToMove(lead.locator('svg [data-part="mouth"]')),
  ]);
  await page.screenshot({ path: test.info().outputPath("hindi-speaking.png") });
  await expect(
    page.getByText("दर्द लगातार रहता है या बीच-बीच में आता है?"),
  ).not.toBeVisible();
  await expect(lead).toHaveAttribute("data-motion", "listening");
  nativeSocket!.close({ code: 1011, reason: "synthetic network interruption" });
  await expect.poll(() => connections).toBe(2);
  expect(resumeRequests).toBe(1);
  expect(tickets).toEqual(["synthetic-ticket", "renewed-synthetic-ticket"]);
  await expect(page.getByText("HELIOS आपकी बात सुन रहा है")).toBeAttached();

  // A handoff must move the existing actors, not replace the whole scene image.
  await actors.evaluateAll((elements) => {
    elements.forEach((element, index) => {
      (element as HTMLElement).dataset.qaIdentity = `original-actor-${index}`;
    });
  });
  const identities = await actors.evaluateAll((elements) =>
    elements.map((element) => (element as HTMLElement).dataset.qaIdentity),
  );
  let previousId = "lead-general";
  for (const nextId of [
    "clinician-female",
    "clinician-general",
    "clinician-surgical",
    "clinician-senior",
  ]) {
    const next = actor(nextId);
    const previous = actor(previousId);
    const backgroundBox = await next.boundingBox();
    const foregroundBox = await previous.boundingBox();
    expect(backgroundBox).not.toBeNull();
    expect(foregroundBox).not.toBeNull();
    nativeSocket!.send(
      JSON.stringify({ type: "handoff", doctorAvatarId: nextId }),
    );
    await expect(scene).toHaveAttribute("data-active-clinician", nextId);
    await expect(next).toHaveAttribute("data-active", "true");
    await expect(previous).toHaveAttribute("data-active", "false");
    await expect(scene.locator('[data-active="true"]')).toHaveCount(1);
    await expect
      .poll(async () => (await next.boundingBox())!.height)
      .toBeGreaterThan(backgroundBox!.height * 1.2);
    await expect
      .poll(async () => (await previous.boundingBox())!.height)
      .toBeLessThan(foregroundBox!.height * 0.85);
    await expect
      .poll(async () => {
        const activeBox = (await next.boundingBox())!;
        const sceneBox = (await scene.boundingBox())!;
        return Math.abs(
          activeBox.x + activeBox.width / 2 - (sceneBox.x + sceneBox.width / 2),
        );
      })
      .toBeLessThan(15);
    expect(
      await actors.evaluateAll((elements) =>
        elements.map((element) => (element as HTMLElement).dataset.qaIdentity),
      ),
    ).toEqual(identities);
    nativeSocket!.send(
      JSON.stringify({
        type: "caption",
        text: "आपकी जानकारी डॉक्टर के लिए तैयार है।",
      }),
    );
    nativeSocket!.send(Buffer.alloc(96000));
    await expect(next).toHaveAttribute("data-motion", "speaking");
    await expect(previous).toHaveAttribute("data-motion", "idle");
    if (nextId === "clinician-female") {
      await page.screenshot({
        path: test.info().outputPath("hindi-female-handoff.png"),
      });
    }
    await expect(next).toHaveAttribute("data-motion", "listening");
    previousId = nextId;
  }

  const longCaption =
    "आपको यह दर्द कब से हो रहा है? क्या चलने, सीढ़ियाँ चढ़ने या गहरी साँस लेने पर यह बढ़ता है? क्या इसके साथ चक्कर, पसीना या साँस लेने में तकलीफ़ भी होती है?";
  nativeSocket!.send(JSON.stringify({ type: "caption", text: longCaption }));
  nativeSocket!.send(Buffer.alloc(96000));
  const longBubble = page.getByRole("status").filter({ hasText: longCaption });
  await expect(longBubble).toBeVisible();
  const bubbleBox = await longBubble.boundingBox();
  const headBox = await actor(previousId)
    .locator('svg [data-part="head"]')
    .boundingBox();
  expect(bubbleBox).not.toBeNull();
  expect(headBox).not.toBeNull();
  await page.screenshot({
    path: test.info().outputPath("hindi-long-question.png"),
  });
  expect(bubbleBox!.y + bubbleBox!.height).toBeLessThanOrEqual(
    headBox!.y + headBox!.height * 0.25,
  );
  await expect(longBubble).not.toBeVisible();

  await page.emulateMedia({ reducedMotion: "reduce" });
  nativeSocket!.send(
    JSON.stringify({ type: "handoff", doctorAvatarId: "lead-general" }),
  );
  await expect(lead).toHaveAttribute("data-active", "true");
  await expect
    .poll(() =>
      scene.evaluate(
        (element) => element.getAnimations({ subtree: true }).length,
      ),
    )
    .toBe(0);
  nativeSocket!.send(JSON.stringify({ type: "completed" }));
  await expect(page.getByText("आपकी जानकारी सुरक्षित हो गई है")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const violations = (
    await new AxeBuilder({ page }).analyze()
  ).violations.filter((item) =>
    ["serious", "critical"].includes(item.impact ?? ""),
  );
  expect(violations).toEqual([]);
});
