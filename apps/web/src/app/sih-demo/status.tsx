"use client";

import { useEffect, useState } from "react";
import type { HealthData } from "@helios/shared";
import { getApiHealth } from "@/services/health";

export function DemoConnectionStatus() {
  const [health, setHealth] = useState<HealthData>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const result = await getApiHealth();
        if (active) {
          setHealth(result.success ? result.data : undefined);
          setFailed(!result.success);
        }
      } catch {
        if (active) {
          setHealth(undefined);
          setFailed(true);
        }
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const connected = health?.api === "up" && health.database === "up";
  return (
    <section
      aria-label="Live demo readiness"
      className="mt-9 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
    >
      <div>
        <strong className="block">Live system status</strong>
        <span className="text-slate-600">
          Backend: {health?.api ?? (failed ? "Unavailable" : "Checking…")} ·
          Database: {health?.database ?? (failed ? "Unavailable" : "Checking…")}
        </span>
      </div>
      <span
        role="status"
        className={`rounded-full px-3 py-1.5 text-xs font-bold ${connected ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"}`}
      >
        {connected ? "Connected to real services" : "Check service readiness"}
      </span>
    </section>
  );
}
