import { expect, test } from "@playwright/test";
import type { InterviewDto } from "@helios/shared";
import { resolve } from "node:path";

test("real recording, interview refresh, local PDF, submission and doctor review", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.SPEECH_PROVIDER !== "local",
    "Run pnpm speech:setup and configure SPEECH_PROVIDER=local for real speech coverage.",
  );
  test.setTimeout(180_000);
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(error.message));
  await page.goto("/patient");
  await page.getByRole("button", { name: "Start check-in" }).click();
  await expect(page).toHaveURL(/\/patient\/language/);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "I Understand & Continue" }).click();
  await page.getByLabel("Full name").fill("Aarav Sharma");
  await page.getByLabel("Age", { exact: true }).fill("24");
  await page.getByRole("button", { name: "Male", exact: true }).click();
  // The complaint conversation asks, then automatically starts listening.
  // Register both requests before navigation so the fake microphone recording
  // cannot complete before this test observes it.
  const transcribed = page.waitForResponse(
    (r) =>
      r.url().endsWith("/voice/transcribe") && r.request().method() === "POST",
  );
  const initialized = page.waitForResponse(
    (r) => /\/interviews\/?$/.test(r.url()) && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const voice = await transcribed;
  expect(voice.status(), await voice.text()).toBe(201);
  const voiceBody = await voice.json();
  expect(voiceBody.data.originalTranscript).toMatch(/fever/i);
  expect(voiceBody.data.originalTranscript).toMatch(/headache/i);
  const initialResponse = await initialized;
  expect(initialResponse.status()).toBe(201);
  let interview: InterviewDto = (await initialResponse.json()).data;
  await expect(page).toHaveURL(/\/patient\/interview/);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: interview.currentQuestion!.text,
      exact: true,
    }),
  ).toBeVisible();
  // The primary experience remains hands-free. Switch this remainder of the
  // browser journey to the explicitly provided text fallback so its form
  // assertions cannot race another fake microphone recording.
  await page.getByRole("button", { name: "Type instead", exact: true }).click();
  await expect(
    page.getByText("Voice conversation is paused. Answer in the live form."),
  ).toBeVisible();

  for (let count = 0; interview.currentQuestion && count < 20; count++) {
    const question = interview.currentQuestion;
    if (question.inputType === "SLIDER") {
      await page.getByRole("slider").fill("4");
    } else if (question.options?.length) {
      const choice =
        question.options.find((o) => o === "No") ??
        question.options.find((o) => o === "None of these") ??
        question.options.find((o) => o === "1–3 days") ??
        question.options[0]!;
      await page.getByRole("button", { name: choice, exact: true }).click();
    } else {
      await page.getByLabel("Your answer", { exact: true }).fill("Not sure");
    }
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Is this correct?" }),
    ).toBeVisible();
    const confirmed = page.waitForResponse(
      (r) =>
        /\/interviews\/[^/]+\/confirm$/.test(r.url()) &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Sounds right/ }).click();
    const response = await confirmed;
    expect(response.ok(), await response.text()).toBe(true);
    interview = (await response.json()).data;
  }
  await expect(
    page.getByRole("heading", { name: "Please review what we understood" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review your information" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "General Medicine / Internal Medicine",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Choose doctor" }).click();
  await expect(
    page.getByRole("button", { name: "Selected", exact: true }),
  ).toBeVisible();
  await page.goto("/patient/documents");
  await page
    .locator('input[type="file"][accept^="application/pdf"]')
    .setInputFiles(
      resolve("dataset/documents/phase6-fixtures/demo-current-lab-report.pdf"),
    );
  await page.getByRole("button", { name: "Confirm and upload" }).click();
  await expect(
    page.getByRole("button", { name: "Done reviewing" }),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Done reviewing" }).click();
  const submitted = page.waitForResponse((r) =>
    /\/patient-sessions\/[^/]+\/submit$/.test(r.url()),
  );
  await page.getByRole("button", { name: "Submit for consultation" }).click();
  const submitResponse = await submitted;
  expect(submitResponse.ok(), await submitResponse.text()).toBe(true);
  const session = (await submitResponse.json()).data;
  const token = session.visit.tokenNumber as string;
  expect(token).toMatch(/^A-\d{3}$/);
  await expect(page.getByText(token, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /View live waiting status/ }).click();
  await expect(
    page.getByRole("heading", { name: "You’re checked in" }),
  ).toBeVisible();

  const doctorContext = await browser.newContext();
  const doctor = await doctorContext.newPage();
  doctor.on("pageerror", (error) => crashes.push(error.message));
  await doctor.goto("/doctor/login");
  await doctor.getByLabel("Doctor ID").fill("demo.doctor");
  await doctor
    .getByLabel("Access code")
    .fill(process.env.DOCTOR_DEMO_ACCESS_CODE ?? "");
  await doctor.getByRole("button", { name: "Enter doctor workspace" }).click();
  await doctor.getByRole("link", { name: "Full queue" }).click();
  const row = doctor.locator("article").filter({ hasText: token });
  await row.getByRole("button", { name: "Call", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your turn" })).toBeVisible({
    timeout: 20_000,
  });
  await row.getByRole("link", { name: "Aarav Sharma", exact: true }).click();
  await expect(doctor).toHaveURL(/\/doctor\/patients\//, { timeout: 20_000 });
  await expect(
    doctor.getByRole("heading", { name: "Clinical brief" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(doctor.getByText(/fever and a headache/).first()).toBeVisible();
  expect(crashes).toEqual([]);
  await doctorContext.close();
});
