from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pebr_stats.backtest import BacktestPoint, rolling_origin, summarize
from pebr_stats.calibration import calibrate_empirical_intervals
from pebr_stats.projection_calibration import calibrate_projection, rolling_projection_backtest
from pebr_stats.multifold_projection_calibration import (
    rolling_temporal_calibration,
    summarize_validation_coverage,
)
from pebr_stats.projection_v2_backtest import (
    ProjectionV2BacktestResult,
    ProjectionV2GateSummary,
    rolling_projection_v2_backtest,
    summarize_projection_v2,
)
from pebr_stats.dataset import candidate_series, load_poll_rows
from pebr_stats.tracking import TrackingPoll, rolling_tracking_sensitivity
from pebr_stats.composition import load_composition_polls, rolling_composition_backtest


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

    projection_v2_rows = []
    projection_v2_gate_eligible = 0
    projection_v2_gate_passes = 0
    for (scenario, candidate), observations in groups.items():
        result = rolling_projection_v2_backtest(
            observations,
            scenario=scenario,
            candidate=candidate,
        )
        projection_v2_rows.extend(result.rows)
        projection_v2_gate_eligible += result.gate.eligible_origins
        projection_v2_gate_passes += result.gate.gate_pass_origins

    projection_v2_result = ProjectionV2BacktestResult(
        rows=tuple(projection_v2_rows),
        gate=ProjectionV2GateSummary(
            eligible_origins=projection_v2_gate_eligible,
            gate_pass_origins=projection_v2_gate_passes,
            pass_rate=(
                projection_v2_gate_passes / projection_v2_gate_eligible
                if projection_v2_gate_eligible
                else 0.0
            ),
        ),
    )
    projection_v2_metrics = [
        item.__dict__ for item in summarize_projection_v2(projection_v2_result)
    ]
    projection_multifold_folds = rolling_temporal_calibration(
        projection_rows,
        target_coverage=0.90,
        fold_count=3,
        min_calibration_origins=5,
    )
    projection_multifold_calibration = [
        item.__dict__ for item in projection_multifold_folds
    ]
    projection_multifold_summary = summarize_validation_coverage(
        projection_multifold_folds
    )
    tracking_metrics = []
    tracking_overlap_pairs = 0
    for (scenario, candidate), observations in groups.items():
        tracking_rows = []
        raw_rows = load_poll_rows(args.path)
        normalized_names = {candidate.casefold()}
        for row in raw_rows:
            if str(row.get("scenario") or "").strip() != scenario:
                continue
            start = str(row.get("fieldwork_start") or row.get("fieldwork_end") or "")[:10]
            end = str(row.get("fieldwork_end") or row.get("published_date") or "")[:10]
            try:
                from datetime import datetime, timezone
                start_ms = datetime.fromisoformat(start).replace(tzinfo=timezone.utc).timestamp() * 1000
                end_ms = datetime.fromisoformat(end).replace(tzinfo=timezone.utc).timestamp() * 1000
            except ValueError:
                continue
            for raw_candidate in row.get("candidates") or []:
                if str(raw_candidate.get("name") or "").casefold() not in normalized_names:
                    continue
                try:
                    value = float(raw_candidate.get("pct"))
                except (TypeError, ValueError):
                    continue
                tracking_rows.append(
                    TrackingPoll(
                        institute=str(row.get("institute") or ""),
                        scenario=scenario,
                        geo=str(row.get("geo") or "BR"),
                        start=start_ms,
                        end=end_ms,
                        y=value,
                        n=float(row.get("n") or 0),
                    )
                )
        metrics_for_group, overlap_pairs = rolling_tracking_sensitivity(tracking_rows)
        tracking_overlap_pairs += overlap_pairs
        tracking_metrics.extend(
            {
                "scenario": scenario,
                "candidate": candidate,
                **metric.__dict__,
            }
            for metric in metrics_for_group
        )

    composition_polls = load_composition_polls(load_poll_rows(args.path))
    composition_metrics = [
        metric.__dict__
        for metric in rolling_composition_backtest(composition_polls)
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
        "projection_multifold_calibration": projection_multifold_calibration,
        "projection_multifold_summary": projection_multifold_summary,
        "projection_v2_gate": projection_v2_result.gate.__dict__,
        "projection_v2_metrics": projection_v2_metrics,
        "tracking_overlap_pair_count": tracking_overlap_pairs,
        "tracking_sensitivity": tracking_metrics,
        "first_round_composition_complete_case_polls": len(composition_polls),
        "first_round_composition_metrics": composition_metrics,
    }
    payload = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(payload, encoding="utf-8")
    print(payload, end="")


if __name__ == "__main__":
    main()
