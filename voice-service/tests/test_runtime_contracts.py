import unittest
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from helios_voice_bench.runtime.contracts import SessionPolicy
from helios_voice_bench.runtime.human1 import Human1Adapter


class SessionPolicyTests(unittest.TestCase):
    def test_accepts_locked_patient_policy(self) -> None:
        SessionPolicy(session_id="session-1", language_mode="hi-Hinglish").validate()

    def test_rejects_clinical_authority(self) -> None:
        with self.assertRaises(ValueError):
            SessionPolicy(
                session_id="session-1",
                language_mode="hi-Hinglish",
                allow_diagnosis=True,
            ).validate()

    def test_rejects_english_only_mode(self) -> None:
        with self.assertRaises(ValueError):
            SessionPolicy(session_id="session-1", language_mode="en").validate()


class Human1AdapterTests(unittest.TestCase):
    def test_fails_closed_without_torch(self) -> None:
        adapter = Human1Adapter()
        with patch("importlib.util.find_spec", return_value=None):
            capabilities = adapter.capabilities()
        self.assertEqual("unavailable", capabilities.state)
        self.assertFalse(capabilities.full_duplex)
        self.assertFalse(capabilities.benchmark_approved)

    def test_never_claims_benchmark_approval_from_preflight(self) -> None:
        adapter = Human1Adapter()
        with self.assertRaises(RuntimeError):
            adapter.start()

    def test_benchmark_gate_requires_measured_complete_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            gate_path = root / "gate.json"
            results_path = root / "results.jsonl"
            scenario_ids = [f"H{index:02d}" for index in range(1, 16)]
            gate_path.write_text(
                json.dumps(
                    {
                        "requiredScenarioIds": scenario_ids,
                        "thresholds": {
                            "maxTimeToFirstAudioMsP95": 1500,
                            "maxGenerationCancelMsP95": 350,
                            "maxStaleAudioAfterCancelMsP95": 250,
                            "maxUnexpectedTurnEndCount": 1,
                            "maxLanguageDriftCount": 0,
                            "maxHinglishCodeSwitchFailures": 0,
                            "minSemanticCorrectionSuccessRate": 0.9,
                        },
                    }
                ),
                encoding="utf-8",
            )
            records = [
                {
                    "scenarioId": scenario_id,
                    "measured": True,
                    "timeToFirstAudioMs": 300,
                    "generationCancelMs": 80,
                    "staleAudioAfterCancelMs": 30,
                    "unexpectedTurnEndCount": 0,
                    "languageDriftCount": 0,
                    "hinglishCodeSwitchFailures": 0,
                    "semanticCorrectionSuccess": True,
                }
                for scenario_id in scenario_ids
            ]
            results_path.write_text(
                "\n".join(json.dumps(record) for record in records) + "\n",
                encoding="utf-8",
            )
            adapter = Human1Adapter(
                benchmark_results_path=str(results_path),
                benchmark_gate_path=str(gate_path),
            )
            approved, reason = adapter._benchmark_approval()
            self.assertTrue(approved)
            self.assertEqual("measured benchmark gate passed", reason)

            records[0]["measured"] = False
            results_path.write_text(
                "\n".join(json.dumps(record) for record in records) + "\n",
                encoding="utf-8",
            )
            rejected, rejection_reason = adapter._benchmark_approval()
            self.assertFalse(rejected)
            self.assertIn("non-measured/mock results cannot pass", rejection_reason)


if __name__ == "__main__":
    unittest.main()
