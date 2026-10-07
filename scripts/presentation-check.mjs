// Read-only local service check. It never prints credentials or patient data.
const checks = [
  ["Patient web", "http://localhost:3000/patient"],
  ["Patient API", "http://127.0.0.1:8080/actuator/health"],
  ["Voice gateway", "http://127.0.0.1:9090/healthz"],
];
const results = await Promise.all(
  checks.map(async ([service, url]) => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      return {
        service,
        status: response.ok ? "PASS" : "FAIL",
        httpStatus: response.status,
      };
    } catch {
      return { service, status: "FAIL", detail: "Unavailable or timed out" };
    }
  }),
);
console.log(
  JSON.stringify(
    {
      checks: results,
      note: "Service health only. Use voice:smoke to verify the external model and voice:roundtrip for a synthetic handoff.",
    },
    null,
    2,
  ),
);
if (results.some((item) => item.status !== "PASS")) process.exitCode = 1;
