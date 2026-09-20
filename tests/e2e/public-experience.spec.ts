import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("private PDF preview policy permits local blobs but blocks embedding HELIOS", async ({
  request,
}) => {
  const response = await request.get("/patient");
  expect(response.ok()).toBe(true);
  const policy = response.headers()["content-security-policy"];
  expect(policy).toContain("frame-src 'self' blob:");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("object-src 'none'");
});

for (const viewport of [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
]) {
  test(`@responsive patient entry fits ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/patient");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const start = page.getByRole("button", { name: /start check-in/i });
    await expect(start).toBeVisible();
    const box = await start.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

for (const width of [1024, 1280, 1440, 1920]) {
  test(`@responsive doctor login fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/doctor/login");
    await expect(
      page.getByRole("heading", { name: "Sign in to your workspace" }),
    ).toBeVisible();
    await expect(page.getByLabel("Access code")).toHaveValue("");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

for (const path of ["/patient", "/doctor/login"]) {
  test(`@a11y ${path} has no serious automated accessibility violations`, async ({
    page,
  }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? ""),
      ),
    ).toEqual([]);
  });
}

test("@performance records public patient navigation timing", async ({
  page,
}) => {
  await page.goto("/patient");
  const timing = await page.evaluate(() => {
    const entry = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    return {
      responseEndMs: Math.round(entry.responseEnd),
      domContentLoadedMs: Math.round(entry.domContentLoadedEventEnd),
      loadMs: Math.round(entry.loadEventEnd),
    };
  });
  expect(timing.responseEndMs).toBeGreaterThan(0);
  console.log(`PHASE19_PERFORMANCE ${JSON.stringify(timing)}`);
});
