"use client";

import { translateMessage, type LocaleMessageKey } from "@helios/shared";
import { useOptionalPatientFlow } from "@/providers/patient-flow-provider";

export function useTranslation() {
  // Translation is presentation-only. Guarding here caused every header,
  // progress bar and page to independently resume the same patient session.
  const flow = useOptionalPatientFlow();
  // Older persisted sessions and lightweight component-test doubles may not
  // carry the Phase 12 language field yet. English is the explicit migration
  // fallback rather than allowing an undefined locale lookup.
  const language = flow?.state.language === "hi" ? "hi" : "en";
  return {
    language,
    direction: "ltr" as const,
    t: (key: LocaleMessageKey) => translateMessage(language, key),
  };
}
