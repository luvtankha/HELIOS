"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePatientFlow } from "@/providers/patient-flow-provider";

export function useSessionGuard() {
  const router = useRouter();
  const flow = usePatientFlow();
  const { resume, state } = flow;
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!state.hydrated) {
      setSessionReady(false);
      return () => {
        active = false;
      };
    }
    if (!state.sessionId) {
      setSessionReady(false);
      router.replace("/patient");
      return () => {
        active = false;
      };
    }
    setSessionReady(false);
    void resume()
      .then(() => {
        if (active) setSessionReady(true);
      })
      .catch(() => {
        if (active) router.replace("/patient");
      });
    return () => {
      active = false;
    };
  }, [resume, state.hydrated, state.sessionId, router]);

  return { ...flow, sessionReady };
}
