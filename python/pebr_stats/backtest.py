from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import Iterable, Sequence

from .contract import PollObservation
from .estimator import weighted_estimate


DAY_MS = 86_400_000


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


def _date_mean(points: Sequence[PollObservation], t: float) -> float | None:
    values = [p.y for p in points if p.t == t and p.y == p.y]
    return sum(values) / len(values) if values else None


def _persistence(points: Sequence[PollObservation], origin: float) -> float | None:
    dates = sorted({p.t for p in points if p.t <= origin and p.y == p.y})
    if not dates:
        return None
    return _date_mean(points, dates[-1])


def rolling_origin(
    points: Iterable[PollObservation],
    *,
    horizons: Sequence[int] = (1, 3, 7),
    min_history: int = 5,
) -> list[BacktestPoint]:
    rows = sorted((p for p in points if p.y == p.y), key=lambda p: p.t)
    origin_times = sorted({p.t for p in rows})
    if len(origin_times) < min_history:
        return []

    out: list[BacktestPoint] = []

    for origin in origin_times[min_history - 1 :]:
        history = [p for p in rows if p.t <= origin]
        for horizon in horizons:
            target = origin + horizon * DAY_MS
            future_dates = [t for t in origin_times if t >= target]
            if not future_dates:
                continue

            actual_date = future_dates[0]
            actual = _date_mean(rows, actual_date)
            if actual is None:
                continue

            persistence = _persistence(history, origin)
            if persistence is not None:
                out.append(BacktestPoint(origin, horizon, actual, persistence, "persistence"))

            estimate = weighted_estimate(
                history,
                date=origin,
                candidate="backtest",
                half_life_days=14,
            ).estimate
            if estimate is not None:
                out.append(BacktestPoint(origin, horizon, actual, estimate, "canonical-weighted"))
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
