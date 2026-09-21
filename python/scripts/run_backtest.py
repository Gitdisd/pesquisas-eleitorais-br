from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pebr_stats.backtest import BacktestPoint, rolling_origin, summarize
from pebr_stats.dataset import candidate_series, load_poll_rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Run rolling-origin poll backtests.")
    parser.add_argument("path", help="Path to data/polls.json")
    parser.add_argument("--output", help="Write the JSON report to this path")
    args = parser.parse_args()

    groups = candidate_series(load_poll_rows(args.path))
    all_rows = []
    for (scenario, candidate), observations in groups.items():
        rows = rolling_origin(observations)
        for row in rows:
            all_rows.append(
                {
                    "scenario": scenario,
                    "candidate": candidate,
                    "origin": row.origin,
                    "horizon_days": row.horizon_days,
                    "actual": row.actual,
                    "predicted": row.predicted,
                    "model": row.model,
                }
            )

    metrics = []
    for metric in summarize(
        [
            BacktestPoint(
                origin=row["origin"],
                horizon_days=row["horizon_days"],
                actual=row["actual"],
                predicted=row["predicted"],
                model=row["model"],
            )
            for row in all_rows
        ]
    ):
        metrics.append(metric.__dict__)

    report = {"groups": len(groups), "backtest_points": len(all_rows), "metrics": metrics}
    payload = json.dumps(report, indent=2, sort_keys=True) + "\\n"
    if args.output:
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(payload, encoding="utf-8")
    print(payload, end="")


if __name__ == "__main__":
    main()
