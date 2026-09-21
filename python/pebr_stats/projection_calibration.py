from __future__ import annotations

from dataclasses import dataclass
from math import exp, sqrt
from typing import Iterable, Sequence

from .contract import PollObservation, pollWeight


DAY_MS = 86_400_000


@dataclass(frozen=True)
class ProjectionBacktestPoint:
    origin: float
    horizon_days: int
    actual: float
    predicted: float
    half_width: float
    scenario: str
    candidate: str


@dataclass(frozen=True)
class ProjectionCalibration:
    horizon_days: int
    calibration_n: int
    validation_n: int
    target_coverage: float
    scale_factor: float
    calibration_coverage: float
    validation_coverage: float


def weighted_trend(
    points: Sequence[PollObservation],
    *,
    half_life_days: float = 14,
) -> list[tuple[float, float]]:
    rows = sorted((p for p in points if p.y == p.y), key=lambda p: p.t)
    if not rows:
        return []
    half = max(1.0, float(half_life_days))
    start = rows[0].t
    end = rows[-1].t
    out: list[tuple[float, float]] = []

    for t in range(int(start), int(end) + 1, DAY_MS):
        numerator = 0.0
        denominator = 0.0
        nearest = float("inf")
        for point in rows:
            days = abs(t - point.t) / DAY_MS
            nearest = min(nearest, days)
            if days > half * 2.5:
                continue
            weight = pollWeight(point, t, half).total
            numerator += weight * point.y
            denominator += weight
        if denominator > 0 and nearest <= half:
            out.append((float(t), numerator / denominator))
    return out


def project_trend(
    series: Sequence[tuple[float, float]],
    *,
    fit_days: int = 14,
    horizon_days: int = 14,
    min_points: int = 4,
    max_abs_slope: float = 0.25,
    damp_tau_days: float = 10.0,
    z: float = 1.645,
    band_floor: float = 2.0,
    process_sd: float = 0.12,
) -> list[tuple[float, float, float]]:
    ordered = sorted(series)
    if not ordered:
        return []
    last_x, last_y = ordered[-1]
    cut = last_x - fit_days * DAY_MS
    window = [p for p in ordered if p[0] >= cut]
    if len(window) < min_points:
        return []

    t0 = window[0][0]
    n = len(window)
    sum_t = sum((x - t0) / DAY_MS for x, _ in window)
    sum_y = sum(y for _, y in window)
    sum_tt = sum(((x - t0) / DAY_MS) ** 2 for x, _ in window)
    sum_ty = sum(((x - t0) / DAY_MS) * y for x, y in window)
    denominator = n * sum_tt - sum_t * sum_t
    slope = 0.0 if denominator == 0 else (n * sum_ty - sum_t * sum_y) / denominator
    intercept = (sum_y - slope * sum_t) / n
    slope = max(-max_abs_slope, min(max_abs_slope, slope))

    sse = 0.0
    for x, y in window:
        t = (x - t0) / DAY_MS
        sse += (y - (intercept + slope * t)) ** 2
    rmse = sqrt(sse / max(1, n - 2))

    out = [(last_x, last_y, 0.0)]
    for day in range(1, max(1, int(horizon_days)) + 1):
        x = last_x + day * DAY_MS
        delta = slope * damp_tau_days * (1 - exp(-day / damp_tau_days))
        y = max(0.0, min(100.0, last_y + delta))
        half_width = z * sqrt(
            rmse * rmse * (1 + day / fit_days)
            + band_floor * band_floor
            + process_sd * process_sd * day
        )
        out.append((x, y, half_width))
    return out


def _date_mean(points: Sequence[PollObservation], date: float) -> float | None:
    values = [p.y for p in points if p.t == date and p.y == p.y]
    return sum(values) / len(values) if values else None


def rolling_projection_backtest(
    points: Iterable[PollObservation],
    *,
    scenario: str = "",
    candidate: str = "",
    horizons: Sequence[int] = (1, 3, 7, 14),
    min_history_dates: int = 6,
) -> list[ProjectionBacktestPoint]:
    rows = sorted((p for p in points if p.y == p.y), key=lambda p: p.t)
    dates = sorted({p.t for p in rows})
    if len(dates) < min_history_dates:
        return []

    out: list[ProjectionBacktestPoint] = []
    for origin in dates[min_history_dates - 1 :]:
        history = [p for p in rows if p.t <= origin]
        trend = weighted_trend(history)
        if not trend or trend[-1][0] != origin:
            continue
        projection = project_trend(trend)
        if not projection:
            continue
        by_x = {x: (y, half_width) for x, y, half_width in projection}
        for horizon in horizons:
            future_dates = [date for date in dates if date >= origin + horizon * DAY_MS]
            if not future_dates:
                continue
            target = future_dates[0]
            if target > origin + max(horizons) * DAY_MS:
                continue
            actual = _date_mean(rows, target)
            forecast = by_x.get(target)
            if actual is None or forecast is None or forecast[2] <= 0:
                continue
            out.append(
                ProjectionBacktestPoint(
                    origin=origin,
                    horizon_days=horizon,
                    actual=actual,
                    predicted=forecast[0],
                    half_width=forecast[1],
                    scenario=scenario,
                    candidate=candidate,
                )
            )
    return out


def _quantile(values: Sequence[float], probability: float) -> float:
    ordered = sorted(values)
    if not ordered:
        raise ValueError("quantile requires at least one value")
    p = max(0.0, min(1.0, probability))
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * p
    lo = int(position)
    hi = min(lo + 1, len(ordered) - 1)
    fraction = position - lo
    return ordered[lo] + (ordered[hi] - ordered[lo]) * fraction


def calibrate_projection(
    rows: Iterable[ProjectionBacktestPoint],
    *,
    target_coverage: float = 0.90,
    calibration_fraction: float = 0.70,
) -> list[ProjectionCalibration]:
    grouped: dict[int, list[ProjectionBacktestPoint]] = {}
    for row in rows:
        grouped.setdefault(row.horizon_days, []).append(row)

    out: list[ProjectionCalibration] = []
    for horizon, group in sorted(grouped.items()):
        origins = sorted({row.origin for row in group})
        if len(origins) < 3:
            continue
        cutoff = origins[max(0, min(len(origins) - 1, int(len(origins) * calibration_fraction) - 1))]
        calibration = [row for row in group if row.origin <= cutoff]
        validation = [row for row in group if row.origin > cutoff]
        if not calibration or not validation:
            continue

        ratios = [
            abs(row.predicted - row.actual) / row.half_width
            for row in calibration
            if row.half_width > 0
        ]
        factor = _quantile(ratios, target_coverage)
        cal_coverage = sum(
            abs(row.predicted - row.actual) <= factor * row.half_width + 1e-12
            for row in calibration
        ) / len(calibration)
        val_coverage = sum(
            abs(row.predicted - row.actual) <= factor * row.half_width + 1e-12
            for row in validation
        ) / len(validation)
        out.append(
            ProjectionCalibration(
                horizon_days=horizon,
                calibration_n=len(calibration),
                validation_n=len(validation),
                target_coverage=target_coverage,
                scale_factor=factor,
                calibration_coverage=cal_coverage,
                validation_coverage=val_coverage,
            )
        )
    return out
