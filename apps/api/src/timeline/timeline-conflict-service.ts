export class TimelineConflictService {
  conflictKeys(
    rows: Array<{
      conflictKey: string | null;
      normalizedValue: unknown;
      originalValue: unknown;
    }>,
  ) {
    const values = new Map<string, string>();
    const conflicts = new Set<string>();
    for (const row of rows) {
      if (!row.conflictKey || conflicts.has(row.conflictKey)) continue;
      const value = stableValue(row.normalizedValue ?? row.originalValue);
      if (!values.has(row.conflictKey)) values.set(row.conflictKey, value);
      else if (values.get(row.conflictKey) !== value)
        conflicts.add(row.conflictKey);
    }
    const orderedConflicts = new Set<string>();
    for (const key of values.keys()) {
      if (conflicts.has(key)) orderedConflicts.add(key);
    }
    return orderedConflicts;
  }
}

function stableValue(value: unknown) {
  if (!value || typeof value !== "object")
    return JSON.stringify(value) ?? "undefined";
  const sorted = Object.entries(value as Record<string, unknown>).sort(
    ([a], [b]) => a.localeCompare(b),
  );
  return JSON.stringify(Object.fromEntries(sorted));
}
