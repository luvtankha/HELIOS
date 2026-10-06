import type { SnapshotFact } from "./types.js";

export interface EntityPair {
  key: string;
  previous?: SnapshotFact;
  current?: SnapshotFact;
  duplicate: boolean;
}

export class EntityMatcher {
  match(previous: SnapshotFact[], current: SnapshotFact[]): EntityPair[] {
    const previousGroups = group(previous);
    const currentGroups = group(current);
    return [...new Set([...previousGroups.keys(), ...currentGroups.keys()])]
      .sort()
      .map((key) => {
        const previous = previousGroups.get(key)?.first;
        const current = currentGroups.get(key)?.first;
        return {
          key,
          ...(previous && { previous }),
          ...(current && { current }),
          duplicate:
            previousGroups.get(key)?.duplicate === true ||
            currentGroups.get(key)?.duplicate === true,
        };
      });
  }
}

function group(facts: SnapshotFact[]) {
  const map = new Map<string, { first: SnapshotFact; duplicate: boolean }>();
  for (const fact of facts) {
    const key = `${fact.entityType}:${fact.entityKey}`;
    const existing = map.get(key);
    if (existing) existing.duplicate = true;
    else map.set(key, { first: fact, duplicate: false });
  }
  return map;
}
