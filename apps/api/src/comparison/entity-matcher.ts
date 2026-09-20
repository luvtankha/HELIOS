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
        const previous = previousGroups.get(key)?.[0];
        const current = currentGroups.get(key)?.[0];
        return {
          key,
          ...(previous && { previous }),
          ...(current && { current }),
          duplicate:
            (previousGroups.get(key)?.length ?? 0) > 1 ||
            (currentGroups.get(key)?.length ?? 0) > 1,
        };
      });
  }
}

function group(facts: SnapshotFact[]) {
  const map = new Map<string, SnapshotFact[]>();
  for (const fact of facts) {
    const key = `${fact.entityType}:${fact.entityKey}`;
    map.set(key, [...(map.get(key) ?? []), fact]);
  }
  return map;
}
