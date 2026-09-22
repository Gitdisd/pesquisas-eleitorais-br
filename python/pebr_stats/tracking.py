from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import Iterable, Sequence

from .contract import DAY_MS, MAX_SAMPLE, MIN_SAMPLE, N_REF


@dataclass(frozen=True)
class TrackingPoll:
    institute: str
    scenario: str
    geo: str
    start: float
    end: float
    y: float
    n: float


@dataclass(frozen=True)
class TrackingMetric:
    rho: float
    horizon_days: int
    n: int
    mae: float
    rmse: float


def _sample_size(n: float) -> float:
    return min(MAX_SAMPLE, max(MIN_SAMPLE, n)) if n > 0 else 800.0


def _base_weight(point: TrackingPoll, t: float, half_life_days: float) -> float:
    days = abs(t - point.end) / DAY_MS
    recency = 2.0 ** (-days / max(1.0, half_life_days))
    return sqrt(_sample_size(point.n) / N_REF) * recency


def _overlap_fraction(left: TrackingPoll, right: TrackingPoll) -> float:
    if left.institute.casefold() != right.institute.casefold():
        return 0.0
    if left.scenario.casefold() != right.scenario.casefold():
        return 0.0
    if left.geo.casefold() != right.geo.casefold():
        return 0.0
    overlap = min(left.end, right.end) - max(left.start, right.start) + DAY_MS
    if overlap <= 0:
        return 0.0
    left_len = max(DAY_MS, left.end - left.start + DAY_MS)
    right_len = max(DAY_MS, right.end - right.start + DAY_MS)
    return min(1.0, overlap / min(left_len, right_len))


def tracking_design_effect(
    point: TrackingPoll,
    history: Sequence[TrackingPoll],
    *,
    rho: float,
) -> float:
    r = max(0.0, min(0.95, float(rho)))
    exposure = sum(_overlap_fraction(point, peer) for peer in history if peer is not point)
    return max(1.0, 1.0 + r * exposure)


def tracking_weighted_mean(
    points: Sequence[TrackingPoll],
    t: float,
    *,
    half_life_days: float = 14.0,
    rho: float = 0.0,
) -> float | None:
    rows = [p for p in points if p.end <= t and p.y == p.y]
    if not rows:
        return None
    num = 0.0
    den = 0.0
    for point in rows:
        weight = _base_weight(point, t, half_life_days) / tracking_design_effect(point, rows, rho=rho)
        num += weight * point.y
        den += weight
    return None if den <= 0 else num / den


def overlap_pair_count(rows: Iterable[TrackingPoll]) -> int:
    ordered = list(rows)
    return sum(
        _overlap_fraction(left, right) > 0
        for index, left in enumerate(ordered)
        for right in ordered[index + 1 :]
    )


def rolling_tracking_sensitivity(
    rows: Iterable[TrackingPoll],
    *,
    rhos: Sequence[float] = (0.0, 0.10, 0.25, 0.50, 0.75),
    horizons: Sequence[int] = (1, 3, 7),
    min_history_dates: int = 6,
) -> tuple[list[TrackingMetric], int]:
    observations = sorted(
        (row for row in rows if row.y == row.y and row.end >= row.start),
        key=lambda row: (row.end, row.institute, row.start),
    )
    dates = sorted({row.end for row in observations})
    if len(dates) < min_history_dates:
        return [], overlap_pair_count(observations)

    errors: dict[tuple[float, int], list[float]] = {}
    for origin in dates[min_history_dates - 1 :]:
        history = [row for row in observations if row.end <= origin]
        for horizon in horizons:
            target_dates = [date for date in dates if date >= origin + horizon * DAY_MS]
            if not target_dates:
                continue
            target = target_dates[0]
            actual_rows = [row for row in observations if row.end == target]
            if not actual_rows:
                continue
            actual = sum(row.y for row in actual_rows) / len(actual_rows)
            for rho in rhos:
                estimate = tracking_weighted_mean(history, origin, rho=rho)
                if estimate is not None:
                    errors.setdefault((float(rho), horizon), []).append(estimate - actual)

    metrics: list[TrackingMetric] = []
    for rho in rhos:
        for horizon in sorted(horizons):
            group = errors.get((float(rho), horizon), [])
            if not group:
                continue
            metrics.append(
                TrackingMetric(
                    rho=float(rho),
                    horizon_days=horizon,
                    n=len(group),
                    mae=sum(abs(error) for error in group) / len(group),
                    rmse=sqrt(sum(error * error for error in group) / len(group)),
                )
            )
    return metrics, overlap_pair_count(observations)
