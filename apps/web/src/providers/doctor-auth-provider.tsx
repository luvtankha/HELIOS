"use client";

import type { DoctorSessionDto } from "@helios/shared";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doctorDashboardApi } from "@/services/doctor-dashboard";

const STORAGE_KEY = "helios-doctor-session";
type DoctorAuth = {
  session: DoctorSessionDto | undefined;
  hydrated: boolean;
  signIn(username: string, accessCode: string): Promise<void>;
  signOut(): void;
};
const Context = createContext<DoctorAuth | undefined>(undefined);

export function DoctorAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<DoctorSessionDto>();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSession(JSON.parse(stored) as DoctorSessionDto);
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);
  const value = useMemo<DoctorAuth>(
    () => ({
      session,
      hydrated,
      async signIn(username, accessCode) {
        const next = await doctorDashboardApi.signIn(username, accessCode);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setSession(next);
      },
      signOut() {
        sessionStorage.removeItem(STORAGE_KEY);
        setSession(undefined);
      },
    }),
    [session, hydrated],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDoctorAuth() {
  const value = useContext(Context);
  if (!value)
    throw new Error("useDoctorAuth must be used inside DoctorAuthProvider");
  return value;
}
