import type { BriefClaimDraft } from "./types.js";

const prohibited = [
  /\b(severe anemia|gastritis|ulcer|appendicitis)\b/i,
  /\b(likely|suggestive of|consistent with|appears to have|deteriorat\w*|worsen\w*)\b/i,
  /\b(start|stop|continue|increase|decrease|prescribe|order)\b.{0,30}\b(medication|metformin|test|dose)\b/i,
];

export class BriefNarrativeRenderer {
  render(claims: BriefClaimDraft[]) {
    const top = claims
      .filter((claim) =>
        [
          "TODAYS_REASON",
          "CURRENT_SYMPTOMS",
          "WHAT_CHANGED",
          "NEEDS_VERIFICATION",
        ].includes(claim.sectionType),
      )
      .slice(0, 6)
      .map((claim) => claim.text);
    return top.length
      ? top.join(" ")
      : "Not enough information has been collected to generate a complete clinical brief.";
  }

  validate(candidate: string, claims: BriefClaimDraft[]) {
    if (prohibited.some((pattern) => pattern.test(candidate))) return false;
    const allowedNumbers = new Set(
      claims.flatMap((claim) => claim.text.match(/\d+(?:\.\d+)?/g) ?? []),
    );
    return (candidate.match(/\d+(?:\.\d+)?/g) ?? []).every((value) =>
      allowedNumbers.has(value),
    );
  }

  renderOptional(candidate: string | undefined, claims: BriefClaimDraft[]) {
    return candidate && this.validate(candidate, claims)
      ? candidate
      : this.render(claims);
  }
}
