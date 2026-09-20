"use client";

import type {
  LanguageCode,
  PatientFlowStep,
  PatientSessionDto,
  PatientSex,
} from "@helios/shared";
import { languageCodes } from "@helios/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { patientApi } from "@/services/patient-flow";
import { publicConfig } from "@/lib/config";
import type {
  PatientFlowState,
  PatientFormDetails,
} from "@/types/patient-flow";

const LOCAL_KEY = "helios.patient.session.v1";
const DRAFT_KEY = "helios.patient.draft.v1";
const TOKEN_KEY = "helios.patient.token.v1";

const initialState: PatientFlowState = {
  hydrated: false,
  sessionId: null,
  sessionToken: null,
  patientId: null,
  visitId: null,
  interviewId: null,
  pendingQuestionId: null,
  currentStep: "WELCOME",
  language: languageCodes.English,
  details: { fullName: "", age: "", sex: "", phone: "" },
  complaint: "",
  answers: {},
  tokenNumber: null,
  submittedAt: null,
};

interface FlowContextValue {
  state: PatientFlowState;
  setDetails(details: PatientFormDetails): void;
  setComplaint(complaint: string): void;
  setAnswer(key: string, value: string): void;
  setInterviewId(id: string | null): void;
  setPendingQuestionId(id: string | null): void;
  start(): Promise<PatientSessionDto>;
  resume(): Promise<PatientSessionDto>;
  chooseLanguage(language: LanguageCode): Promise<void>;
  acceptConsent(): Promise<void>;
  saveDetails(details: PatientFormDetails): Promise<void>;
  saveInterview(): Promise<void>;
  submit(): Promise<void>;
  reset(): void;
}

const FlowContext = createContext<FlowContextValue | null>(null);

export function PatientFlowProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [state, setState] = useState(initialState);
  const resumeRequest = useRef<Promise<PatientSessionDto> | null>(null);

  useEffect(() => {
    const persisted = readStorage(localStorage, LOCAL_KEY);
    const draft = readStorage(sessionStorage, DRAFT_KEY);
    const sessionToken = sessionStorage.getItem(TOKEN_KEY);
    setState((current) => ({
      ...current,
      ...persisted,
      ...draft,
      sessionToken,
      hydrated: true,
    }));
  }, []);

  useEffect(() => {
    if (!publicConfig.demoMode) return;
    let active = true;
    const checkReset = async () => {
      try {
        const response = await fetch(
          `${publicConfig.apiUrl}/api/v1/demo/state`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          success: boolean;
          data?: { resetId: string | null };
        };
        if (!active || !payload.success || !payload.data?.resetId) return;
        const seenKey = "helios.demo.reset.seen.v1";
        const seen = localStorage.getItem(seenKey);
        localStorage.setItem(seenKey, payload.data.resetId);
        if (seen && seen !== payload.data.resetId) clearAfterDemoReset();
      } catch {
        /* Offline patient UI keeps its current state. */
      }
    };
    const clearAfterDemoReset = () => {
      localStorage.removeItem(LOCAL_KEY);
      sessionStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      setState({ ...initialState, hydrated: true });
      window.location.assign("/patient/language");
    };
    const onReset = (event: StorageEvent) => {
      if (event.key !== "helios.demo.reset.v1") return;
      clearAfterDemoReset();
    };
    window.addEventListener("storage", onReset);
    void checkReset();
    const timer = window.setInterval(() => void checkReset(), 8_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("storage", onReset);
    };
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({
        sessionId: state.sessionId,
        patientId: state.patientId,
        visitId: state.visitId,
        interviewId: state.interviewId,
        pendingQuestionId: state.pendingQuestionId,
        currentStep: state.currentStep,
        language: state.language,
      }),
    );
    if (state.sessionToken)
      sessionStorage.setItem(TOKEN_KEY, state.sessionToken);
    else sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        details: state.details,
        complaint: state.complaint,
        answers: state.answers,
      }),
    );
  }, [state]);

  const hydrate = useCallback((session: PatientSessionDto) => {
    setState((previous) => {
      const current =
        previous.sessionId === session.id ? previous : initialState;
      return {
        ...current,
        hydrated: true,
        sessionId: session.id,
        sessionToken: session.sessionToken ?? current.sessionToken,
        patientId: session.patient?.id ?? current.patientId,
        visitId: session.visit?.id ?? current.visitId,
        currentStep: session.currentStep,
        language:
          session.language === languageCodes.Hindi
            ? languageCodes.Hindi
            : languageCodes.English,
        details: session.patient
          ? {
              fullName: session.patient.fullName,
              age: String(session.patient.age),
              sex: session.patient.sex,
              phone: session.patient.phone ?? "",
            }
          : current.details,
        complaint:
          current.complaint ||
          session.visit?.chiefComplaint ||
          session.draft?.complaint ||
          "",
        answers: {
          ...session.visit?.healthDetails,
          ...session.draft,
          ...current.answers,
        },
        tokenNumber: session.visit?.tokenNumber ?? current.tokenNumber,
      };
    });
  }, []);

  const start = useCallback(async () => {
    const session = await patientApi.createSession(languageCodes.English);
    hydrate(session);
    return session;
  }, [hydrate]);

  const resume = useCallback(async () => {
    if (!state.sessionId || !state.sessionToken)
      throw new Error("No saved session");
    if (resumeRequest.current) return resumeRequest.current;
    const request = patientApi
      .getSession(state.sessionId, state.sessionToken)
      .then((session) => {
        hydrate(session);
        return session;
      })
      .finally(() => {
        if (resumeRequest.current === request) resumeRequest.current = null;
      });
    resumeRequest.current = request;
    return request;
  }, [hydrate, state.sessionId, state.sessionToken]);

  const chooseLanguage = useCallback(
    async (language: LanguageCode) => {
      if (!state.sessionId || !state.sessionToken)
        throw new Error("No active session");
      const session = await patientApi.updateProgress(
        state.sessionId,
        {
          currentStep:
            state.currentStep === "LANGUAGE" ? "CONSENT" : state.currentStep,
          language,
        },
        state.sessionToken,
      );
      hydrate(session);
    },
    [hydrate, state.currentStep, state.sessionId, state.sessionToken],
  );

  const acceptConsent = useCallback(async () => {
    if (!state.sessionId || !state.sessionToken)
      throw new Error("No active session");
    await patientApi.saveConsent(state.sessionId, state.sessionToken);
    setState((current) => ({ ...current, currentStep: "BASIC_INFO" }));
  }, [state.sessionId, state.sessionToken]);

  const saveDetails = useCallback(
    async (details: PatientFormDetails) => {
      if (!state.sessionId || !state.sessionToken || !details.sex)
        throw new Error("Patient details are incomplete");
      const result = await patientApi.savePatient(
        {
          sessionId: state.sessionId,
          fullName: details.fullName,
          age: Number(details.age),
          sex: details.sex as PatientSex,
          preferredLanguage: state.language,
          ...(details.phone && { phone: details.phone }),
        },
        state.sessionToken,
      );
      setState((current) => ({
        ...current,
        details,
        patientId: result.patient.id,
        visitId: result.visitId,
        currentStep: "CHIEF_COMPLAINT",
      }));
    },
    [state.language, state.sessionId, state.sessionToken],
  );

  const saveInterview = useCallback(async () => {
    if (!state.sessionId || !state.sessionToken)
      throw new Error("Patient session is not ready");
    // Completing the interview already persists the full clinical summary in
    // one backend transaction. Re-saving its legacy three-field subset here
    // could reject newer answers and overwrite the richer clinical record.
    const session = await patientApi.updateProgress(
      state.sessionId,
      {
        currentStep: "REVIEW",
      },
      state.sessionToken,
    );
    hydrate(session);
  }, [
    hydrate,
    state.sessionId,
    state.sessionToken,
  ]);

  const submit = useCallback(async () => {
    if (!state.sessionId || !state.sessionToken)
      throw new Error("No active session");
    const session = await patientApi.submit(
      state.sessionId,
      state.sessionToken,
    );
    hydrate(session);
    setState((current) => ({
      ...current,
      submittedAt: new Date().toISOString(),
    }));
  }, [hydrate, state.sessionId, state.sessionToken]);

  const reset = useCallback(() => {
    localStorage.removeItem(LOCAL_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    setState({ ...initialState, hydrated: true });
  }, []);

  const value = useMemo<FlowContextValue>(
    () => ({
      state,
      setDetails: (details) => setState((current) => ({ ...current, details })),
      setComplaint: (complaint) =>
        setState((current) => ({
          ...current,
          complaint,
          interviewId:
            complaint === current.complaint ? current.interviewId : null,
          pendingQuestionId: null,
        })),
      setAnswer: (key, answer) =>
        setState((current) => ({
          ...current,
          answers: { ...current.answers, [key]: answer },
        })),
      setInterviewId: (interviewId) =>
        setState((current) => ({ ...current, interviewId })),
      setPendingQuestionId: (pendingQuestionId) =>
        setState((current) => ({ ...current, pendingQuestionId })),
      start,
      resume,
      chooseLanguage,
      acceptConsent,
      saveDetails,
      saveInterview,
      submit,
      reset,
    }),
    [
      acceptConsent,
      chooseLanguage,
      reset,
      resume,
      saveDetails,
      saveInterview,
      start,
      state,
      submit,
    ],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function usePatientFlow() {
  const value = useContext(FlowContext);
  if (!value)
    throw new Error("usePatientFlow must be used inside PatientFlowProvider");
  return value;
}

/** Presentation hooks may render in isolated tests before the app provider. */
export function useOptionalPatientFlow() {
  return useContext(FlowContext);
}

function readStorage(storage: Storage, key: string): Partial<PatientFlowState> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const value = parsed as Record<string, unknown>;
    const result: Partial<PatientFlowState> = {};
    for (const field of [
      "sessionId",
      "patientId",
      "visitId",
      "interviewId",
      "pendingQuestionId",
    ] as const) {
      if (value[field] === null || typeof value[field] === "string")
        result[field] = value[field];
    }
    if (value.language === "en" || value.language === "hi")
      result.language = value.language;
    if (
      typeof value.currentStep === "string" &&
      Object.hasOwn(stepRoutes, value.currentStep)
    ) {
      result.currentStep = value.currentStep as PatientFlowStep;
    }
    if (typeof value.complaint === "string")
      result.complaint = value.complaint.slice(0, 4000);
    const details = value.details;
    if (details && typeof details === "object" && !Array.isArray(details)) {
      const fields = details as Record<string, unknown>;
      if (
        ["fullName", "age", "phone"].every(
          (field) => typeof fields[field] === "string",
        ) &&
        ["", "MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"].includes(
          String(fields.sex),
        )
      ) {
        result.details = {
          fullName: fields.fullName as string,
          age: fields.age as string,
          phone: fields.phone as string,
          sex: fields.sex as PatientFormDetails["sex"],
        };
      }
    }
    if (
      value.answers &&
      typeof value.answers === "object" &&
      !Array.isArray(value.answers)
    ) {
      result.answers = Object.fromEntries(
        Object.entries(value.answers).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
    }
    return result;
  } catch {
    return {};
  }
}

export const stepRoutes: Record<PatientFlowStep, string> = {
  WELCOME: "/patient",
  LANGUAGE: "/patient/language",
  CONSENT: "/patient/consent",
  BASIC_INFO: "/patient/details",
  CHIEF_COMPLAINT: "/patient/complaint",
  INTERVIEW: "/patient/interview",
  REVIEW: "/patient/review",
  SUBMITTED: "/patient/review",
  COMPLETE: "/patient/complete",
};
