import { FactNormalizer } from "./fact-normalizer.js";
import type { FieldDelta, SnapshotFact } from "./types.js";

export class FieldComparator {
  constructor(private readonly normalizer = new FactNormalizer()) {}

  compare(previous: SnapshotFact, current: SnapshotFact): FieldDelta[] {
    const fields = [
      ...new Set([
        ...Object.keys(previous.fields),
        ...Object.keys(current.fields),
      ]),
    ]
      .filter((field) => !["name", "state"].includes(field))
      .sort();
    const quantity = this.quantityDelta(previous.fields, current.fields);
    return fields.flatMap((field) => {
      if (["value", "unit"].includes(field) && quantity) {
        return field === "value" &&
          (!quantity.comparable || quantity.absoluteDelta !== 0)
          ? [quantity]
          : [];
      }
      const left = previous.fields[field];
      const right = current.fields[field];
      if (this.normalizer.stable(left) === this.normalizer.stable(right))
        return [];
      return [
        { field, previousValue: left, currentValue: right, comparable: true },
      ];
    });
  }

  private quantityDelta(
    previous: Record<string, unknown>,
    current: Record<string, unknown>,
  ): FieldDelta | undefined {
    if (previous.value === undefined || current.value === undefined) return;
    const left = this.normalizer.quantity(previous.value, previous.unit);
    const right = this.normalizer.quantity(current.value, current.unit);
    if (!left || !right)
      return {
        field: "value",
        previousValue: previous.value,
        currentValue: current.value,
        comparable: false,
      };
    if (left.unit !== right.unit)
      return {
        field: "value",
        previousValue: previous.value,
        currentValue: current.value,
        comparable: false,
      };
    const absoluteDelta = round(right.value - left.value);
    return {
      field: "value",
      previousValue: previous.value,
      currentValue: current.value,
      absoluteDelta,
      ...(left.value !== 0 && {
        percentageDelta: round((absoluteDelta / left.value) * 100),
      }),
      unit: left.unit,
      comparable: true,
    };
  }
}

const round = (value: number) => Math.round(value * 100) / 100;
