from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import Callable, Iterable, Sequence

from .contract import PollObservation
from .estimator import weighted_estimate


@dataclass(frozen=True)
class BacktestPoint:
    origin: float
    horizon_days: int
    actual: float
    predicted: float
    model: str


@dataclass(frozen=True)
class BacktestMetrics:
    model: str
    horizon_days: int
    n: int
    mae: float
    rmse: float


def _persistence(points: Sequence[PollObservation], origin: float) -> float | None:
    eligible = [p for p in points if p.t <= origin and p.y == p.y]
    return eligible[-1].y if eligible else None


def rolling_origin(
    points: Iterable[PollObservation],
    *,
    horizons: Sequence[int] = (1, 3, 7),
    min_history: int = 5,
) -> list[BacktestPoint]:
    rows = sorted((p for p in points if p.y == p.y), key=lambda p: p.t)
    if len(rows) < min_history:
        return []

    # Use unique observation dates as forecast origins. This prevents multiple
    # polls sharing the same date from leaking an arbitrary within-day ordering
    # into the backtest.
    origin_times = sorted({p.t for p in rows})
    out: list[BacktestPoint] = []

    for origin in origin_times[min_history - 1 :]:
        history = [p for p in rows if p.t <= origin]
        if len(history) < min_history:
            continue

        for horizon in horizons:
            target = origin + horizon * 86_400_000
            actual = next((p for p in rows if p.t >= target), None)
            if actual is None:
                continue

            persistence = _persistence(history, origin)
            if persistence is not None:
                out.append(BacktestPoint(origin, horizon, actual.y, persistence, "persistence"))

            estimate = weighted_estimate(
                history,
                date=origin,
                candidate="backtest",
                half_life_days=14,
            ).estimate
            if estimate is not None:
                out.append(BacktestPoint(origin, horizon, actual.y, estimate, "canonical-weighted"))
    return out


def summarize(rows: Iterable[BacktestPoint]) -> list[BacktestMetrics]:
    groups: dict[tuple[str, int], list[BacktestPoint]] = {}
    for row in rows:
        groups.setdefault((row.model, row.horizon_days), []).append(row)

    out: list[BacktestMetrics] = []
    for (model, horizon), group in sorted(groups.items()):
        errors = [r.predicted - r.actual for r in group]
        mae = sum(abs(e) for e in errors) / len(errors)
        rmse = sqrt(sum(e * e for e in errors) / len(errors))
        out.append(BacktestMetrics(model, horizon, len(group), mae, rmse))
    return out
