if (!process.argv.includes("--allow-local"))
  throw new Error("Local load smoke requires the explicit --allow-local flag");
const target = new URL(
  process.env.TEST_LOAD_URL ?? "http://127.0.0.1:3000/patient",
);
if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname))
  throw new Error("Load smoke refuses non-local targets");
if (!["/patient", "/health", "/api/v1/health"].includes(target.pathname))
  throw new Error("Load smoke target path is not allow-listed");

for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    const response = await fetch(target);
    if (response.ok) break;
  } catch {
    if (attempt === 39)
      throw new Error("Local test target did not become ready");
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const durations = [];
let failures = 0;
for (let batch = 0; batch < 8; batch += 1) {
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      const started = performance.now();
      try {
        const response = await fetch(target, {
          headers: { "x-helios-test": "phase19-local-load" },
        });
        if (!response.ok) failures += 1;
        await response.arrayBuffer();
      } catch {
        failures += 1;
      } finally {
        durations.push(performance.now() - started);
      }
    }),
  );
}
durations.sort((left, right) => left - right);
const percentile = (value) =>
  Math.round(
    durations[
      Math.min(durations.length - 1, Math.ceil(durations.length * value) - 1)
    ] ?? 0,
  );
const result = {
  target: target.href,
  requests: durations.length,
  concurrency: 5,
  failures,
  p50Ms: percentile(0.5),
  p95Ms: percentile(0.95),
  maxMs: percentile(1),
};
console.log(`PHASE19_LOAD ${JSON.stringify(result)}`);
if (failures) process.exitCode = 1;
