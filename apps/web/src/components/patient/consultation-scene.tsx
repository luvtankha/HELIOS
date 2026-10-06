"use client";

import { useState, type CSSProperties } from "react";
import type { ConsultationPhase } from "@/lib/live-consultation-state";
import { getClinicianSvg } from "./clinician-artwork";
import styles from "./live-consultation.module.css";

const clinicians = [
  { id: "clinician-general", name: "Dr. Kabir", hindiName: "डॉ. कबीर" },
  { id: "clinician-female", name: "Dr. Meera", hindiName: "डॉ. मीरा" },
  { id: "lead-general", name: "Dr. Aarav", hindiName: "डॉ. आरव" },
  { id: "clinician-surgical", name: "Dr. Sana", hindiName: "डॉ. सना" },
  { id: "clinician-senior", name: "Dr. Ananya", hindiName: "डॉ. अनन्या" },
].map((clinician) => ({
  ...clinician,
  // These are locally authored vector parts, never remote or patient content.
  artwork: getClinicianSvg(clinician.id),
}));

const supportingPositions = [-40, -24, 24, 40] as const;

export function ConsultationScene({
  phase,
  doctorAvatarId,
  awaitingConsent,
  complete,
}: {
  phase: ConsultationPhase;
  doctorAvatarId: string;
  awaitingConsent: boolean;
  complete: boolean;
}) {
  const [inspectedClinician, setInspectedClinician] = useState<string | null>(null);
  const [dismissedClinician, setDismissedClinician] = useState<string | null>(null);
  const activeId = clinicians.some(({ id }) => id === doctorAvatarId)
    ? doctorAvatarId
    : "lead-general";
  const supportingIds = clinicians
    .filter(({ id }) => id !== activeId)
    .map(({ id }) => id);
  const listening = !awaitingConsent && !complete && phase === "listening";
  const speaking = !awaitingConsent && !complete && phase === "doctor-speaking";
  const scene = speaking && activeId === "clinician-female"
    ? "female-speaking"
    : listening
      ? "listening"
      : speaking
        ? "speaking"
        : "welcome";

  return (
    <div
      className={styles.scene}
      data-testid="consultation-scene"
      data-active-clinician={activeId}
      data-visual-state={scene}
    >
      <div className={styles.hospital} aria-hidden="true" />
      {clinicians.map((clinician, index) => {
        const active = clinician.id === activeId;
        const slot = supportingIds.indexOf(clinician.id);
        const offset = active ? 0 : (supportingPositions[slot] ?? 0);
        const motion = active && speaking
          ? "speaking"
          : active && listening
            ? "listening"
            : "idle";
        const inspected = inspectedClinician === clinician.id;
        const tooltipId = `consultation-${clinician.id}-description`;
        const placement = {
          "--actor-x": `${offset}%`,
          "--actor-y": active ? "0%" : "-13%",
          "--actor-scale": active ? 1 : 0.72,
          "--actor-delay": `${index * -0.77}s`,
        } as CSSProperties;

        return (
          <div
            key={clinician.id}
            className={styles.actorPlacement}
            style={placement}
            data-foreground={active}
            data-inspected={inspected}
          >
            <button
              type="button"
              className={styles.actor}
              data-clinician-id={clinician.id}
              data-active={active}
              data-motion={motion}
              data-inspected={inspected}
              data-tooltip-dismissed={dismissedClinician === clinician.id}
              data-edge={offset <= -35 ? "left" : offset >= 35 ? "right" : "middle"}
              aria-label={`${clinician.name}${active ? ", active clinician" : ", supporting clinician"}`}
              aria-describedby={tooltipId}
              onClick={() => {
                setDismissedClinician(inspected ? clinician.id : null);
                setInspectedClinician(inspected ? null : clinician.id);
              }}
              onPointerEnter={() => setDismissedClinician(null)}
              onFocus={() => setDismissedClinician(null)}
              onBlur={() => {
                setInspectedClinician(null);
                setDismissedClinician(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setInspectedClinician(null);
                  setDismissedClinician(clinician.id);
                }
              }}
            >
              <span className={styles.actorShadow} aria-hidden="true" />
              <span className={styles.headHalo} aria-hidden="true" />
              <span className={styles.floorHalo} aria-hidden="true" />
              <span
                className={styles.figure}
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: clinician.artwork }}
              />
              <span role="tooltip" id={tooltipId} className={styles.actorTooltip}>
                <strong>{clinician.hindiName}</strong>
                <span>HELIOS का AI मार्गदर्शक</span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ConsultationBrand() {
  return (
    <div className={styles.brand}>
      <svg
        viewBox="0 0 40 40"
        aria-hidden="true"
        className={styles.brandSymbol}
      >
        <defs>
          <linearGradient id="consultation-brand" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#208aff" />
            <stop offset="1" stopColor="#7350ff" />
          </linearGradient>
        </defs>
        <g fill="url(#consultation-brand)">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <ellipse
              key={angle}
              cx="20"
              cy="9"
              rx="4.4"
              ry="8"
              transform={`rotate(${angle} 20 20)`}
            />
          ))}
        </g>
        <circle cx="20" cy="20" r="5" fill="#eef5ff" />
      </svg>
      <strong>HELIOS</strong>
    </div>
  );
}
