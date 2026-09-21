from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import Iterable, Sequence

from .backtest import BacktestPoint


@dataclass(frozen=True)
class IntervalCalibration:
    model: str
    horizon_days: int
    n: int
    target_coverage: float
    half_width: float
    empirical_coverage: float
    mae: float
    rmse: float


def _quantile(values: Sequence[float], probability: float) -> float:
    if not values:
        raise ValueError("quantile requires at least one value")
    p = max(0.0, min(1.0, probability))
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * p
    lo = int(position)
    hi = min(lo + 1, len(ordered) - 1)
    fraction = position - lo
    return ordered[lo] + (ordered[hi] - ordered[lo]) * fraction


def calibrate_empirical_intervals(
    rows: Iterable[BacktestPoint],
    *,
    target_coverage: float = 0.90,
    model: str | None = None,
) -> list[IntervalCalibration]:
    groups: dict[tuple[str, int], list[BacktestPoint]] = {}
    for row in rows:
        if model is not None and row.model != model:
            continue
        groups.setdefault((row.model, row.horizon_days), []).append(row)

    out: list[IntervalCalibration] = []
    for (model_name, horizon), group in sorted(groups.items()):
        errors = [abs(row.predicted - row.actual) for row in group]
        width = _quantile(errors, target_coverage)
        coverage = sum(error <= width + 1e-12 for error in errors) / len(errors)
        signed = [row.predicted - row.actual for row in group]
        mae = sum(errors) / len(errors)
        rmse = sqrt(sum(error * error for error in signed) / len(signed))
        out.append(
            IntervalCalibration(
                model=model_name,
                horizon_days=horizon,
                n=len(group),
                target_coverage=target_coverage,
                half_width=width,
                empirical_coverage=coverage,
                mae=mae,
                rmse=rmse,
            )
        )
    return out
