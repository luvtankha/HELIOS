"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useDoctorAuth } from "@/providers/doctor-auth-provider";
import { publicConfig } from "@/lib/config";
import { BrandMark } from "@/components/ui/brand-mark";

const navigation = [
  ["Dashboard", "/doctor"],
  ["Patients", "/doctor#patient-search"],
  ["Today’s Queue", "/doctor/queue"],
  ["Verification", "/doctor/verification"],
] as const;

export function DoctorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useDoctorAuth();
  const isLogin = pathname === "/doctor/login";
  useEffect(() => {
    if (!isLogin && auth.hydrated && !auth.session)
      router.replace(`/doctor/login?returnTo=${encodeURIComponent(pathname)}`);
  }, [auth.hydrated, auth.session, isLogin, pathname, router]);
  if (isLogin) return <>{children}</>;
  if (!auth.hydrated || !auth.session)
    return (
      <main className="min-h-screen bg-[#f3f7f8] p-8" aria-busy="true">
        <div className="mx-auto h-40 max-w-3xl animate-pulse rounded-3xl bg-white" />
      </main>
    );
  return (
    <div className="min-h-screen bg-[#f6f8f7] text-[#17344d] lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-[#102b46] p-4 text-white lg:min-h-screen lg:border-b-0 lg:p-5">
        <Link href="/doctor" className="flex items-center gap-3 rounded-xl p-2">
          <BrandMark inverted />
          <span>
            <strong className="block tracking-[0.16em]">HELIOS</strong>
            <small className="text-white/60">Doctor workspace</small>
          </span>
        </Link>
        <nav
          aria-label="Doctor workspace"
          className="mt-5 flex gap-1 overflow-x-auto lg:mt-7 lg:grid lg:grid-cols-1"
        >
          {navigation.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={`shrink-0 rounded-xl px-3 py-3 text-sm font-semibold transition hover:bg-white/10 lg:px-4 ${pathname === href ? "bg-white/15 text-teal-100" : "text-white/80"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4 text-sm lg:mt-8 lg:block lg:pt-5">
          <p className="font-semibold">{auth.session.displayName}</p>
          <p className="mt-1 text-xs uppercase tracking-widest text-white/50">
            {auth.session.role}
          </p>
          <button
            type="button"
            onClick={() => {
              auth.signOut();
              router.replace("/doctor/login");
            }}
            className="min-h-11 rounded-lg border border-white/30 px-3 py-2 text-xs font-bold hover:bg-white/10 lg:mt-4"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-5 py-3 lg:px-8">
          <p className="text-sm font-bold text-slate-500">
            Clinical workspace · private
          </p>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
            {publicConfig.demoMode
              ? "DEMO MODE · synthetic data"
              : "Secure doctor session"}
          </span>
        </header>
        {children}
      </div>
    </div>
  );
}
