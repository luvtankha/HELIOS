import { readFileSync } from "node:fs";
const report = JSON.parse(readFileSync(".local/live-roundtrip.json", "utf8"));
if (report.status !== "passed" || !report.synthetic)
  throw new Error("Run the synthetic native voice roundtrip first");
const base = "http://127.0.0.1:5000/api/v1";
const login = await fetch(`${base}/doctor-sessions`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    username: "helios-local",
    accessCode: process.env.DOCTOR_DEMO_ACCESS_CODE,
  }),
});
if (!login.ok) throw new Error(`Doctor login failed (${login.status})`);
const { data: session } = await login.json();
const workspace = await fetch(
  `${base}/doctor/patients/${report.patientId}/workspace?visitId=${report.visitId}`,
  { headers: { "x-doctor-token": session.doctorToken } },
);
if (!workspace.ok)
  throw new Error(`Doctor workspace failed (${workspace.status})`);
const { data } = await workspace.json();
if (
  data.liveIntake.facts.length < 5 ||
  data.routing.specialization !== "internal-medicine"
)
  throw new Error("Doctor did not receive native intake and routing");
const unauthorized = await fetch(
  `${base}/doctor/patients/${report.patientId}/workspace?visitId=${report.visitId}`,
);
if (![401, 403].includes(unauthorized.status))
  throw new Error("Workspace must require doctor authentication");
console.log(
  JSON.stringify({
    status: "passed",
    doctorLogin: true,
    nativeIntakeFacts: data.liveIntake.facts.length,
    specialization: data.routing.specialization,
    anonymousAccessDenied: true,
  }),
);
