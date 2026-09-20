import { expect, test } from "@playwright/test";

test("SIH entry stays synthetic and presenter guide requires doctor sign-in", async ({
  page,
  browser,
  request,
}) => {
  await page.goto("/sih-demo");
  await expect(
    page.getByRole("heading", {
      name: /Patient waiting time, turned into a clearer clinical story/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Connected to real services",
  );
  await expect(
    page.getByText(/Clinical safety rules are not available/i),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start patient intake" }),
  ).toHaveAttribute("href", "/patient/language");

  await page.getByRole("link", { name: "Open presenter guide" }).click();
  await expect(page).toHaveURL(/\/doctor\/login\?/);
  await page.getByLabel("Doctor ID").fill("demo.doctor");
  await page
    .getByLabel(/access code/i)
    .fill(process.env.DOCTOR_DEMO_ACCESS_CODE ?? "");
  await page.getByRole("button", { name: "Enter doctor workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "One connected HELIOS story" }),
  ).toBeVisible();
  await expect(page.getByText("DEMO-AARAV-024")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open live patient workspace" }),
  ).toHaveAttribute("href", /\/doctor\/patients\/demo-patient-aarav/);
  const baseline = await request.get("http://127.0.0.1:5000/api/v1/demo/state");
  expect(baseline.ok()).toBeTruthy();
  const baselineId = (await baseline.json()).data.resetId as string | null;
  const patientContext = await browser.newContext();
  await patientContext.addInitScript((id) => {
    if (!sessionStorage.getItem("test.initialized")) {
      if (id) localStorage.setItem("helios.demo.reset.seen.v1", id);
      sessionStorage.setItem(
        "helios.patient.token.v1",
        "synthetic-stale-session",
      );
      sessionStorage.setItem("test.initialized", "true");
    }
  }, baselineId);
  const patientPage = await patientContext.newPage();
  await patientPage.goto("/patient/language");
  await page.getByRole("button", { name: "Reset Demo", exact: true }).click();
  await expect(page.getByText(/Reset demo\? This restores/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm Reset Demo" }).click();
  await expect(page.getByText(/Demo reset successfully/)).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText(/Token A-001/)).toBeVisible();
  await expect
    .poll(
      async () => {
        try {
          return await patientPage.evaluate(() =>
            sessionStorage.getItem("helios.patient.token.v1"),
          );
        } catch {
          // Reset intentionally navigates this tab; retry after the new page loads.
          return "navigating";
        }
      },
      { timeout: 25_000 },
    )
    .toBeNull();
  await patientContext.close();
});
