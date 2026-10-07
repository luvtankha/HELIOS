import { expect, test, type Page } from "@playwright/test";

async function simulatedIntake(page: Page) {
  let count = 0;
  let consent = false;
  let complete = false;
  let socket: import("@playwright/test").WebSocketRoute | undefined;
  const current = () => ({
    sessionId: `demo-${count}`,
    sessionToken: "synthetic-proof",
    status: "STARTED",
    currentStep: complete ? "REVIEW" : consent ? "BASIC_INFO" : "CONSENT",
    conversationLanguage: "hi-Hinglish",
    patientId: complete ? "synthetic-patient" : null,
    visitId: complete ? "synthetic-visit" : null,
    startedAt: "2026-10-04T00:00:00Z",
  });
  await page.route("**/api/v2/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (
      path === "/api/v2/patient-sessions" &&
      route.request().method() === "POST"
    ) {
      count++;
      consent = false;
      complete = false;
    }
    if (path === "/api/v2/consents") {
      consent = true;
      await route.fulfill({ json: {} });
    } else if (path.includes("patient-sessions"))
      await route.fulfill({ json: current() });
    else if (path.endsWith("/events"))
      await route.fulfill({ contentType: "application/x-ndjson", body: "" });
    else
      await route.fulfill({
        json: {
          voiceSessionId: `voice-${count}`,
          patientSessionId: `demo-${count}`,
          state: "CONNECTING",
          media: {
            available: true,
            transport: "WEBSOCKET_PCM16",
            websocketUrl: "ws://localhost:9090/v1/stream",
            credential: "synthetic-ticket",
          },
          conversation: {
            languageMode: "hi-Hinglish",
            doctorAvatarId: "lead-general",
            bargeIn: true,
          },
          lastAcknowledgedSequence: 0,
        },
      });
  });
  await page.routeWebSocket("ws://localhost:9090/v1/stream", (connection) => {
    socket = connection;
    connection.onMessage((message) => {
      if (typeof message === "string" && JSON.parse(message).type === "auth")
        connection.send(JSON.stringify({ type: "ready" }));
    });
  });
  return {
    count: () => count,
    socket: () => socket,
    finish: () => {
      complete = true;
      socket?.send(JSON.stringify({ type: "completed" }));
    },
  };
}

test("presentation can complete and start three fresh consultations, including refresh", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const flow = await simulatedIntake(page);
  await page.goto("/patient");
  for (let run = 1; run <= 3; run++) {
    await page.getByRole("button", { name: "हाँ, मैं सहमत हूँ" }).click();
    await expect(page.getByText("HELIOS आपकी बात सुन रहा है")).toBeAttached();
    flow.finish();
    await expect(
      page.getByText("आपकी जानकारी सुरक्षित हो गई है"),
    ).toBeVisible();
    if (run === 1) {
      await page.reload();
      await expect(
        page.getByText("आपकी जानकारी सुरक्षित हो गई है"),
      ).toBeVisible();
    }
    if (run < 3)
      await page.getByRole("button", { name: "नई बातचीत शुरू करें" }).click();
  }
  expect(flow.count()).toBe(3);
  expect(errors).toEqual([]);
});

test("microphone denial gives a usable retry instead of a blank conversation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    let denied = false;
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (!denied) {
        denied = true;
        throw new DOMException(
          "Synthetic permission denial",
          "NotAllowedError",
        );
      }
      return original(constraints);
    };
  });
  await simulatedIntake(page);
  await page.goto("/patient");
  await page.getByRole("button", { name: "हाँ, मैं सहमत हूँ" }).click();
  await page.getByRole("button", { name: "माइक्रोफ़ोन फिर शुरू करें" }).click();
  await expect(page.getByText("HELIOS आपकी बात सुन रहा है")).toBeAttached();
  expect(errors).toEqual([]);
});
