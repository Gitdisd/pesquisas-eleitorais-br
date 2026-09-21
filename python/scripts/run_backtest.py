from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pebr_stats.backtest import BacktestPoint, rolling_origin, summarize
from pebr_stats.calibration import calibrate_empirical_intervals
from pebr_stats.projection_calibration import calibrate_projection, rolling_projection_backtest
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

    backtest_points = [
        BacktestPoint(
            origin=row["origin"],
            horizon_days=row["horizon_days"],
            actual=row["actual"],
            predicted=row["predicted"],
            model=row["model"],
        )
        for row in all_rows
    ]

    metrics = [metric.__dict__ for metric in summarize(backtest_points)]
    calibration = [
        item.__dict__
        for item in calibrate_empirical_intervals(
            backtest_points,
            model="canonical-weighted",
            target_coverage=0.90,
        )
    ]

    projection_rows = []
    for (scenario, candidate), observations in groups.items():
        projection_rows.extend(
            rolling_projection_backtest(
                observations,
                scenario=scenario,
                candidate=candidate,
            )
        )
    projection_calibration = [
        item.__dict__
        for item in calibrate_projection(
            projection_rows,
            target_coverage=0.90,
            calibration_fraction=0.70,
        )
    ]
    projection_metrics = []
    for horizon in sorted({row.horizon_days for row in projection_rows}):
        group = [row for row in projection_rows if row.horizon_days == horizon]
        errors = [abs(row.predicted - row.actual) for row in group]
        covered = [
            row for row in group
            if row.actual >= row.predicted - row.half_width
            and row.actual <= row.predicted + row.half_width
        ]
        projection_metrics.append({
            "horizon_days": horizon,
            "n": len(group),
            "mae": sum(errors) / len(group) if group else None,
            "nominal_interval_coverage": len(covered) / len(group) if group else None,
        })
    report = {
        "groups": len(groups),
        "backtest_points": len(all_rows),
        "metrics": metrics,
        "canonical_weighted_empirical_interval_calibration": calibration,
        "projection_metrics": projection_metrics,
        "projection_calibration": projection_calibration,
    }
    payload = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(payload, encoding="utf-8")
    print(payload, end="")


if __name__ == "__main__":
    main()
