export class TimelineConflictService {
  conflictKeys(
    rows: Array<{
      conflictKey: string | null;
      normalizedValue: unknown;
      originalValue: unknown;
    }>,
  ) {
    const values = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!row.conflictKey) continue;
      const set = values.get(row.conflictKey) ?? new Set<string>();
      set.add(stableValue(row.normalizedValue ?? row.originalValue));
      values.set(row.conflictKey, set);
    }
    return new Set(
      [...values.entries()]
        .filter(([, distinct]) => distinct.size > 1)
        .map(([key]) => key),
    );
  }
}

function stableValue(value: unknown) {
  if (!value || typeof value !== "object") return JSON.stringify(value);
  const sorted = Object.entries(value as Record<string, unknown>).sort(
    ([a], [b]) => a.localeCompare(b),
  );
  return JSON.stringify(Object.fromEntries(sorted));
}
