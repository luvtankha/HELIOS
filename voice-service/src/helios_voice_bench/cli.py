from __future__ import annotations

import argparse
import json
from pathlib import Path

from .core import evaluate_gate, load_json, load_results, validate_scenarios


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="helios-voice-bench")
    sub = parser.add_subparsers(dest="command", required=True)

    validate = sub.add_parser("validate", help="validate the fixed scenario manifest")
    validate.add_argument("scenarios")

    summarize = sub.add_parser("summarize", help="evaluate measured JSONL results")
    summarize.add_argument("results")
    summarize.add_argument(
        "--gate",
        default=str(Path(__file__).resolve().parents[2] / "benchmarks" / "gate.json"),
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.command == "validate":
        errors = validate_scenarios(load_json(args.scenarios))
        if errors:
            for error in errors:
                print(f"ERROR: {error}")
            raise SystemExit(1)
        print("scenario manifest valid")
        return

    report = evaluate_gate(load_results(args.results), load_json(args.gate))
    print(json.dumps({"eligible": report.eligible, "failures": report.failures, "summary": report.summary}, indent=2))
    raise SystemExit(0 if report.eligible else 2)


if __name__ == "__main__":
    main()

