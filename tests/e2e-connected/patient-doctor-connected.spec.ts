import { expect, test, type APIRequestContext } from "@playwright/test";

const apiBase = "http://127.0.0.1:5000/api/v1";

type ApiEnvelope<T> = { success: true; data: T };
type Session = {
  id: string;
  sessionToken: string;
  visit?: { id: string; tokenNumber?: string };
};
type QueueStatus = { tokenNumber: string; status: string };

async function api<T>(
  request: APIRequestContext,
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH";
    token?: string;
    data?: unknown;
    expectedStatus?: number;
  } = {},
) {
  const response = await request.fetch(`${apiBase}${path}`, {
    method: options.method ?? "GET",
    data: options.data,
    headers: options.token ? { "x-session-token": options.token } : {},
  });
  const body = await response.text();
  expect(response.status(), body).toBe(options.expectedStatus ?? 200);
  return JSON.parse(body) as ApiEnvelope<T>;
}

test("connected Hindi patient moves through the doctor queue", async ({
  browser,
  request,
}) => {
  const name = "Kiran Synthetic Patient";
  const created = await api<Session>(request, "/patient-sessions", {
    method: "POST",
    data: { language: "hi" },
    expectedStatus: 201,
  });
  const { id: sessionId, sessionToken } = created.data;
  expect(sessionId).toBeTruthy();
  expect(sessionToken).toBeTruthy();

  await api(request, `/patient-sessions/${sessionId}/progress`, {
    method: "PATCH",
    token: sessionToken,
    data: { currentStep: "CONSENT", language: "hi" },
  });
  await api(request, "/consents", {
    method: "POST",
    token: sessionToken,
    data: {
      sessionId,
      consentType: "PRE_CONSULTATION",
      accepted: true,
      version: "1.0",
    },
    expectedStatus: 201,
  });
  const patient = await api<{ patient: { id: string }; visitId: string }>(
    request,
    "/patients",
    {
      method: "POST",
      token: sessionToken,
      data: {
        sessionId,
        fullName: name,
        age: 30,
        sex: "FEMALE",
        preferredLanguage: "hi",
      },
      expectedStatus: 201,
    },
  );
  const { visitId } = patient.data;
  const patientId = patient.data.patient.id;
  await api(request, `/visits/${visitId}/complaint`, {
    method: "PATCH",
    token: sessionToken,
    data: {
      chiefComplaint: "Teen din se pet mein dard hai",
      healthDetails: { duration: "3 days" },
    },
  });
  await api(request, `/patient-sessions/${sessionId}/progress`, {
    method: "PATCH",
    token: sessionToken,
    data: { currentStep: "REVIEW", language: "hi" },
  });
  const submitted = await api<Session>(
    request,
    `/patient-sessions/${sessionId}/submit`,
    { method: "POST", token: sessionToken },
  );
  const tokenNumber = submitted.data.visit?.tokenNumber;
  expect(tokenNumber).toMatch(/^A-\d{3}$/);

  const status = async () =>
    (
      await api<QueueStatus>(request, "/patient/me/queue-status", {
        token: sessionToken,
      })
    ).data;
  await expect.poll(async () => (await status()).status).toBe("WAITING");

  const patientContext = await browser.newContext();
  await patientContext.addInitScript(
    ({ id, token }) => {
      localStorage.setItem(
        "helios.patient.session.v1",
        JSON.stringify({
          sessionId: id,
          currentStep: "COMPLETE",
          language: "hi",
        }),
      );
      sessionStorage.setItem("helios.patient.token.v1", token);
      sessionStorage.setItem("helios.patient.draft.v1", "{}");
    },
    { id: sessionId, token: sessionToken },
  );
  const patientPage = await patientContext.newPage();
  await patientPage.goto("/patient/waiting");
  await expect(
    patientPage.getByRole("heading", { name: "You’re checked in" }),
  ).toBeVisible();
  await expect(
    patientPage.getByText(tokenNumber!, { exact: true }),
  ).toBeVisible();

  const doctorContext = await browser.newContext();
  const doctorPage = await doctorContext.newPage();
  await doctorPage.goto("/doctor/login");
  await doctorPage.getByLabel("Doctor ID").fill("demo.doctor");
  await doctorPage
    .getByLabel(/access code/i)
    .fill(process.env.DOCTOR_DEMO_ACCESS_CODE ?? "");
  await doctorPage
    .getByRole("button", { name: "Enter doctor workspace" })
    .click();
  await expect(
    doctorPage.getByRole("heading", { name: "Today’s clinic" }),
  ).toBeVisible();
  await doctorPage.getByRole("link", { name: "Full queue" }).click();
  await expect(
    doctorPage.getByRole("heading", {
      name: "Waiting and token management",
    }),
  ).toBeVisible();

  const queueItem = doctorPage.locator("article").filter({ hasText: name });
  await expect(queueItem).toBeVisible();
  await queueItem.getByRole("button", { name: "Call", exact: true }).click();
  await expect.poll(async () => (await status()).status).toBe("CALLED");
  await patientPage.reload();
  await expect(
    patientPage.getByRole("heading", { name: "Your turn" }),
  ).toBeVisible();

  await queueItem.getByRole("link", { name }).click();
  await expect(doctorPage.getByRole("heading", { name })).toBeVisible();
  await expect(
    doctorPage.getByRole("heading", { name: "Clinical brief" }),
  ).toBeVisible();
  await expect(
    doctorPage.getByText("Teen din se pet mein dard hai").first(),
  ).toBeVisible();

  await doctorPage
    .getByRole("link", { name: /Open Verification Center/i })
    .click();
  await expect(
    doctorPage.getByRole("heading", { name: "Verification Center" }),
  ).toBeVisible();
  await doctorPage.getByLabel("Search verification queue").fill(name);
  const reviewCard = doctorPage.locator("article").filter({ hasText: name });
  await expect(reviewCard).toBeVisible();
  await reviewCard.getByRole("button", { name: "Review evidence" }).click();
  await expect(
    doctorPage.getByRole("dialog", { name: "Verification review" }),
  ).toBeVisible();
  await doctorPage.getByRole("button", { name: "Verify", exact: true }).click();
  await doctorPage
    .getByRole("button", { name: "Confirm verify", exact: true })
    .click();
  await expect(doctorPage.getByRole("status")).toContainText(
    /verification|verified/i,
  );
  const history = await request.get(
    `${apiBase}/patients/${patientId}/verification-history`,
    {
      headers: {
        "x-doctor-token": await doctorPage.evaluate(() => {
          const raw = sessionStorage.getItem("helios-doctor-session");
          return raw
            ? (JSON.parse(raw) as { doctorToken: string }).doctorToken
            : "";
        }),
      },
    },
  );
  expect(history.status(), await history.text()).toBe(200);
  expect((await history.json()).data.length).toBeGreaterThan(0);

  await doctorPage.goto("/doctor/queue");
  const activeQueueItem = doctorPage
    .locator("article")
    .filter({ hasText: name });
  await expect(activeQueueItem).toBeVisible();
  const startResponse = doctorPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/doctor/tokens/") &&
      response.url().endsWith("/start"),
  );
  await activeQueueItem
    .getByRole("button", { name: "Start consultation" })
    .click();
  const started = await startResponse;
  expect(started.status(), await started.text()).toBe(200);
  await expect
    .poll(async () => (await status()).status, { timeout: 10_000 })
    .toBe("IN_CONSULTATION");
  await patientPage.reload();
  await expect(
    patientPage.getByRole("heading", {
      name: "Your consultation has started",
    }),
  ).toBeVisible();

  const completeResponse = doctorPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/doctor/tokens/") &&
      response.url().endsWith("/complete"),
  );
  await activeQueueItem
    .getByRole("button", { name: "Complete", exact: true })
    .click();
  const completed = await completeResponse;
  expect(completed.status(), await completed.text()).toBe(200);
  await expect.poll(async () => (await status()).status).toBe("COMPLETED");
  await patientPage.reload();
  await expect(
    patientPage.getByRole("heading", { name: "Consultation complete" }),
  ).toBeVisible();

  await doctorContext.close();
  await patientContext.close();
});
