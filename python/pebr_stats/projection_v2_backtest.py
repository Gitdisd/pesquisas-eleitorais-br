from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import Iterable, Sequence

from .contract import DAY_MS, N_REF, PollObservation, sample_size, poll_weight
from .projection_calibration import project_trend


CAMPAIGN_MS = 1_786_881_600_000  # 2026-08-16T12:00:00Z


@dataclass(frozen=True)
class ProjectionV2BacktestPoint:
    origin: float
    horizon_days: int
    target_date: float
    target_lag_days: float
    actual: float
    predicted: float
    half_width: float
    persistence: float
    scenario: str
    candidate: str


@dataclass(frozen=True)
class ProjectionV2GateSummary:
    eligible_origins: int
    gate_pass_origins: int
    pass_rate: float


@dataclass(frozen=True)
class ProjectionV2Metrics:
    horizon_days: int
    n: int
    mae: float
    rmse: float
    nominal_interval_coverage: float
    persistence_n: int
    persistence_mae: float
    persistence_rmse: float


@dataclass(frozen=True)
class ProjectionV2BacktestResult:
    rows: tuple[ProjectionV2BacktestPoint, ...]
    gate: ProjectionV2GateSummary


def process_sd_for(t_last: float) -> float:
    if t_last >= CAMPAIGN_MS:
        return 0.18
    return 0.12


from .house_effects import estimate_house_effects
def weighted_trend_v2(
    points: Sequence[PollObservation],
    *,
    window_days: float = 14.0,
) -> list[tuple[float, float]]:
    rows = sorted((p for p in points if p.y == p.y), key=lambda p: p.t)
    if not rows:
        return []

    half = max(1.0, float(window_days))
    reach = half * 2.5
    span = int(__import__("math").ceil(max(14.0, half)))

    flood_index: dict[tuple[str, int], int] = {}
    for point in rows:
        if not point.institute:
            continue
        day = round(point.t / DAY_MS)
        for offset in range(-span, span + 1):
            key = (point.institute, day + offset)
            flood_index[key] = flood_index.get(key, 0) + 1

    start = rows[0].t
    end = rows[-1].t
    out: list[tuple[float, float]] = []

    t = start
    while t <= end:
        numerator = 0.0
        denominator = 0.0
        nearest = float("inf")
        day_key = round(t / DAY_MS)

        for point in rows:
            days = abs(t - point.t) / DAY_MS
            nearest = min(nearest, days)
            if days > reach:
                continue
            flood = flood_index.get((point.institute, day_key), 1) if point.institute else 1
            weight = poll_weight(point, t, half, flood).total
            numerator += weight * point.y
            denominator += weight

        if denominator > 0 and nearest <= half:
            out.append((float(t), numerator / denominator))

        t += DAY_MS

    return out


def _nearest(
    line: Sequence[tuple[float, float, float]],
    x: float,
) -> tuple[float, float, float] | None:
    if not line:
        return None
    return min(line, key=lambda point: abs(point[0] - x))


def _date_mean(points: Sequence[PollObservation], date: float) -> float | None:
    values = [point.y for point in points if point.t == date and point.y == point.y]
    return sum(values) / len(values) if values else None


def _holdout_gate(
    trend: Sequence[tuple[float, float]],
    *,
    process_sd: float,
    fit_days: int = 14,
) -> bool:
    if len(trend) < 8:
        return False

    last = trend[-1][0]
    cut = last - 7 * DAY_MS
    train = [point for point in trend if point[0] <= cut]
    test = [point for point in trend if point[0] > cut]
    if len(train) < 4 or len(test) < 2:
        return False

    persistence = train[-1][1]
    projection = project_trend(
        train,
        fit_days=fit_days,
        horizon_days=8,
        process_sd=process_sd,
        band_floor=2.4,
    )
    if not projection:
        return False

    model_se = 0.0
    persistence_se = 0.0
    for target in test:
        forecast = _nearest(projection, target[0])
        predicted = forecast[1] if forecast is not None else persistence
        model_se += (predicted - target[1]) ** 2
        persistence_se += (persistence - target[1]) ** 2

    model_rmse = sqrt(model_se / len(test))
    persistence_rmse = sqrt(persistence_se / len(test))
    return model_rmse + 1e-6 < persistence_rmse


def rolling_projection_v2_backtest(
    points: Iterable[PollObservation],
    *,
    scenario: str = "",
    candidate: str = "",
    horizons: Sequence[int] = (1, 3, 7, 14),
    min_history_dates: int = 6,
) -> ProjectionV2BacktestResult:
    rows = sorted((point for point in points if point.y == point.y), key=lambda point: point.t)
    dates = sorted({point.t for point in rows})
    if len(dates) < min_history_dates:
        return ProjectionV2BacktestResult(
            rows=(),
            gate=ProjectionV2GateSummary(0, 0, 0.0),
        )

    scored: list[ProjectionV2BacktestPoint] = []
    eligible = 0
    gate_passes = 0

    for origin in dates[min_history_dates - 1 :]:
        history = [point for point in rows if point.t <= origin]
        house = estimate_house_effects(history)
        debiased = [
            PollObservation(
                t=point.t,
                y=point.y - house.get(point.institute or "", 0.0),
                n=point.n,
                institute=point.institute,
                moe=point.moe,
            )
            for point in history
        ]
        trend = weighted_trend_v2(debiased)
        if len(trend) < 4:
            continue

        t_last = trend[-1][0]
        cut = t_last - 7 * DAY_MS
        train = [point for point in trend if point[0] <= cut]
        test = [point for point in trend if point[0] > cut]
        if len(train) < 4 or len(test) < 2:
            continue

        eligible += 1
        process_sd = process_sd_for(t_last)
        if not _holdout_gate(trend, process_sd=process_sd):
            continue

        gate_passes += 1
        projection = project_trend(
            trend,
            fit_days=14,
            horizon_days=14,
            max_abs_slope=0.2,
            process_sd=process_sd,
            band_floor=2.4,
        )
        if not projection:
            continue

        by_x = {x: (y, half_width) for x, y, half_width in projection}
        persistence = _date_mean(history, origin)
        if persistence is None:
            continue
        for horizon in horizons:
            targets = [date for date in dates if date >= origin + horizon * DAY_MS]
            if not targets:
                continue
            target_date = targets[0]
            # A sparse target may arrive after the requested nominal horizon;
            # it remains valid while it falls inside the production 14-day cap.
            if target_date > origin + 14 * DAY_MS:
                continue
            actual = _date_mean(rows, target_date)
            forecast = by_x.get(target_date)
            if actual is None or forecast is None or forecast[1] <= 0:
                continue
            scored.append(
                ProjectionV2BacktestPoint(
                    origin=origin,
                    horizon_days=horizon,
                    target_date=target_date,
                    target_lag_days=(target_date - (origin + horizon * DAY_MS)) / DAY_MS,
                    actual=actual,
                    predicted=forecast[0],
                    half_width=forecast[1],
                    persistence=persistence,
                    scenario=scenario,
                    candidate=candidate,
                )
            )

    gate = ProjectionV2GateSummary(
        eligible_origins=eligible,
        gate_pass_origins=gate_passes,
        pass_rate=gate_passes / eligible if eligible else 0.0,
    )
    return ProjectionV2BacktestResult(rows=tuple(scored), gate=gate)


def summarize_projection_v2(
    result: ProjectionV2BacktestResult,
) -> list[ProjectionV2Metrics]:
    out: list[ProjectionV2Metrics] = []
    horizons = sorted({row.horizon_days for row in result.rows})
    for horizon in horizons:
        group = [row for row in result.rows if row.horizon_days == horizon]
        signed = [row.predicted - row.actual for row in group]
        errors = [abs(error) for error in signed]
        persistence_errors = [abs(row.persistence - row.actual) for row in group]
        coverage = sum(
            row.actual >= row.predicted - row.half_width
            and row.actual <= row.predicted + row.half_width
            for row in group
        ) / len(group)
        out.append(
            ProjectionV2Metrics(
                horizon_days=horizon,
                n=len(group),
                mae=sum(errors) / len(group),
                rmse=sqrt(sum(error * error for error in signed) / len(group)),
                nominal_interval_coverage=coverage,
                persistence_n=len(group),
                persistence_mae=sum(persistence_errors) / len(group),
                persistence_rmse=sqrt(
                    sum((row.persistence - row.actual) ** 2 for row in group) / len(group)
                ),
            )
        )
    return out
