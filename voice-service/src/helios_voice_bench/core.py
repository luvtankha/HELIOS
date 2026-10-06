from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from statistics import quantiles
from typing import Any, Iterable


REQUIRED_RESULT_FIELDS = {
    "scenarioId",
    "measured",
    "timeToFirstAudioMs",
    "generationCancelMs",
    "staleAudioAfterCancelMs",
    "unexpectedTurnEndCount",
    "languageDriftCount",
    "hinglishCodeSwitchFailures",
    "semanticCorrectionSuccess",
}


class BenchmarkError(ValueError):
    pass


def load_json(path: str | Path) -> dict[str, Any]:
    with Path(path).open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise BenchmarkError(f"{path} must contain a JSON object")
    return value


def validate_scenarios(document: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    scenarios = document.get("scenarios")
    if document.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1")
    if not isinstance(scenarios, list) or not scenarios:
        return errors + ["scenarios must be a non-empty array"]

    seen: set[str] = set()
    for index, scenario in enumerate(scenarios):
        prefix = f"scenarios[{index}]"
        if not isinstance(scenario, dict):
            errors.append(f"{prefix} must be an object")
            continue
        scenario_id = scenario.get("id")
        if not isinstance(scenario_id, str) or not scenario_id:
            errors.append(f"{prefix}.id is required")
        elif scenario_id in seen:
            errors.append(f"duplicate scenario id: {scenario_id}")
        else:
            seen.add(scenario_id)
        for field in ("name", "patientPrompt"):
            if not isinstance(scenario.get(field), str) or not scenario[field].strip():
                errors.append(f"{prefix}.{field} is required")
        if scenario.get("required") is not True:
            errors.append(f"{prefix}.required must be true for the Phase 4 fixed set")
        if not isinstance(scenario.get("expected"), list) or not scenario["expected"]:
            errors.append(f"{prefix}.expected must be a non-empty array")
    return errors


def load_results(path: str | Path) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    with Path(path).open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise BenchmarkError(f"result line {line_number} must be an object")
            missing = REQUIRED_RESULT_FIELDS - value.keys()
            if missing:
                raise BenchmarkError(
                    f"result line {line_number} missing: {', '.join(sorted(missing))}"
                )
            results.append(value)
    return results


def percentile95(values: Iterable[float]) -> float:
    items = [float(value) for value in values]
    if not items:
        raise BenchmarkError("cannot calculate p95 for an empty metric")
    if len(items) == 1:
        return items[0]
    return quantiles(items, n=100, method="inclusive")[94]


@dataclass(frozen=True)
class GateReport:
    eligible: bool
    failures: tuple[str, ...]
    summary: dict[str, Any]


def evaluate_gate(results: list[dict[str, Any]], gate: dict[str, Any]) -> GateReport:
    failures: list[str] = []
    required = set(gate.get("requiredScenarioIds", []))
    by_id = {str(item["scenarioId"]): item for item in results}
    missing = sorted(required - by_id.keys())
    if missing:
        failures.append(f"missing required measured scenarios: {', '.join(missing)}")

    unmeasured = sorted(
        scenario_id
        for scenario_id, item in by_id.items()
        if scenario_id in required and item.get("measured") is not True
    )
    if unmeasured:
        failures.append(f"non-measured/mock results cannot pass: {', '.join(unmeasured)}")

    complete = [by_id[sid] for sid in sorted(required & by_id.keys()) if by_id[sid].get("measured") is True]
    if not complete:
        return GateReport(False, tuple(failures or ["no measured results"]), {})

    summary = {
        "timeToFirstAudioMsP95": percentile95(x["timeToFirstAudioMs"] for x in complete),
        "generationCancelMsP95": percentile95(x["generationCancelMs"] for x in complete),
        "staleAudioAfterCancelMsP95": percentile95(x["staleAudioAfterCancelMs"] for x in complete),
        "unexpectedTurnEndCount": sum(int(x["unexpectedTurnEndCount"]) for x in complete),
        "languageDriftCount": sum(int(x["languageDriftCount"]) for x in complete),
        "hinglishCodeSwitchFailures": sum(int(x["hinglishCodeSwitchFailures"]) for x in complete),
        "semanticCorrectionSuccessRate": sum(bool(x["semanticCorrectionSuccess"]) for x in complete) / len(complete),
        "measuredScenarioCount": len(complete),
    }

    thresholds = gate.get("thresholds", {})
    comparisons = (
        ("timeToFirstAudioMsP95", "maxTimeToFirstAudioMsP95", "max"),
        ("generationCancelMsP95", "maxGenerationCancelMsP95", "max"),
        ("staleAudioAfterCancelMsP95", "maxStaleAudioAfterCancelMsP95", "max"),
        ("unexpectedTurnEndCount", "maxUnexpectedTurnEndCount", "max"),
        ("languageDriftCount", "maxLanguageDriftCount", "max"),
        ("hinglishCodeSwitchFailures", "maxHinglishCodeSwitchFailures", "max"),
        ("semanticCorrectionSuccessRate", "minSemanticCorrectionSuccessRate", "min"),
    )
    for metric, threshold_name, direction in comparisons:
        if threshold_name not in thresholds:
            failures.append(f"gate threshold missing: {threshold_name}")
            continue
        actual = summary[metric]
        target = thresholds[threshold_name]
        failed = actual > target if direction == "max" else actual < target
        if failed:
            failures.append(f"{metric}={actual} failed {threshold_name}={target}")

    return GateReport(not failures, tuple(failures), summary)

