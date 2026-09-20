import { createHash } from "node:crypto";

const aliases: Record<string, string> = {
  hb: "hemoglobin",
  haemoglobin: "hemoglobin",
  "blood sugar": "glucose",
  glucophage: "metformin",
  breathlessness: "breathing difficulty",
  dyspnea: "breathing difficulty",
};

const massFactors: Record<string, number> = { mcg: 0.001, mg: 1, g: 1000 };

export class FactNormalizer {
  key(value: string) {
    const key = value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
    return aliases[key] ?? key;
  }

  canonicalFields(value: unknown): Record<string, unknown> {
    if (value === null || value === undefined) return {};
    if (typeof value !== "object" || Array.isArray(value)) return { value };
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const nested = source[key];
      if (nested !== undefined) result[key] = nested;
    }
    if (result.result !== undefined && result.value === undefined)
      result.value = result.result;
    delete result.result;
    return result;
  }

  quantity(value: unknown, unit: unknown) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric) || typeof unit !== "string") return undefined;
    const normalizedUnit = unit.trim().toLowerCase().replace("μ", "mc");
    if (normalizedUnit in massFactors)
      return { value: numeric * massFactors[normalizedUnit]!, unit: "mg" };
    return { value: numeric, unit: normalizedUnit };
  }

  stable(value: unknown) {
    return JSON.stringify(sort(value));
  }

  hash(value: unknown) {
    return createHash("sha256").update(this.stable(value)).digest("hex");
  }
}

function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sort(item)]),
  );
}
