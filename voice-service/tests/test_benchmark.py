import json
import tempfile
import unittest
from pathlib import Path

from helios_voice_bench.core import BenchmarkError, evaluate_gate, load_results, validate_scenarios


ROOT = Path(__file__).resolve().parents[1]


class ScenarioTests(unittest.TestCase):
    def test_checked_in_manifest_is_valid(self) -> None:
        document = json.loads((ROOT / "benchmarks" / "scenarios.json").read_text(encoding="utf-8"))
        self.assertEqual([], validate_scenarios(document))
        self.assertEqual(15, len(document["scenarios"]))

    def test_duplicate_scenario_is_rejected(self) -> None:
        document = {"schemaVersion": 1, "scenarios": [
            {"id":"H01","name":"a","required":True,"patientPrompt":"a","expected":["x"]},
            {"id":"H01","name":"b","required":True,"patientPrompt":"b","expected":["x"]},
        ]}
        self.assertTrue(any("duplicate" in error for error in validate_scenarios(document)))


class ResultTests(unittest.TestCase):
    def setUp(self) -> None:
        self.gate = json.loads((ROOT / "benchmarks" / "gate.json").read_text(encoding="utf-8"))

    def _result(self, scenario_id: str, measured: bool = True) -> dict:
        return {
            "scenarioId": scenario_id,
            "measured": measured,
            "timeToFirstAudioMs": 500,
            "generationCancelMs": 100,
            "staleAudioAfterCancelMs": 50,
            "unexpectedTurnEndCount": 0,
            "languageDriftCount": 0,
            "hinglishCodeSwitchFailures": 0,
            "semanticCorrectionSuccess": True,
        }

    def test_gate_rejects_missing_scenarios(self) -> None:
        report = evaluate_gate([self._result("H01")], self.gate)
        self.assertFalse(report.eligible)
        self.assertTrue(any("missing required" in failure for failure in report.failures))

    def test_gate_rejects_mock_results(self) -> None:
        results = [self._result(sid, measured=False) for sid in self.gate["requiredScenarioIds"]]
        report = evaluate_gate(results, self.gate)
        self.assertFalse(report.eligible)
        self.assertTrue(any("mock" in failure for failure in report.failures))

    def test_complete_measured_set_can_pass_engineering_gate(self) -> None:
        results = [self._result(sid) for sid in self.gate["requiredScenarioIds"]]
        report = evaluate_gate(results, self.gate)
        self.assertTrue(report.eligible)
        self.assertEqual(15, report.summary["measuredScenarioCount"])

    def test_jsonl_requires_all_metrics(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "results.jsonl"
            path.write_text('{"scenarioId":"H01"}\n', encoding="utf-8")
            with self.assertRaises(BenchmarkError):
                load_results(path)


if __name__ == "__main__":
    unittest.main()
