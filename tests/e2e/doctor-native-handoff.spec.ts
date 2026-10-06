import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("actual native intake is visible after configured doctor sign-in", async ({ page }) => {
  test.skip(process.env.HELIOS_LIVE_HANDOFF_UI !== "true", "Requires the completed local native-audio roundtrip");
  const report = JSON.parse(readFileSync(".local/live-roundtrip.json", "utf8"));
  expect(report.status).toBe("passed");
  await page.goto("http://localhost:3000/doctor/login");
  await page.getByLabel("Doctor ID", { exact: true }).fill("helios-local");
  await page.getByLabel("Access code", { exact: true }).fill(process.env.DOCTOR_DEMO_ACCESS_CODE!);
  await page.getByRole("button", { name: "Enter doctor workspace" }).click();
  await expect(page).toHaveURL("http://localhost:3000/doctor");
  await page.goto(`http://localhost:3000/doctor/patients/${report.patientId}?visitId=${report.visitId}`);
  await expect(page.getByRole("heading", { name: "Live consultation intake" })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="live-intake-title"] dl > div')).toHaveCount(5);
  await expect(page.getByText("Not enough information is available to prepare a narrative brief.")).toHaveCount(0);
  await expect(page.getByText(/Chief complaint: fatigue/i).first()).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("native-intake-doctor.png"), fullPage: true });
});
