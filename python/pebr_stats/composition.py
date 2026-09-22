from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from math import exp, log, sqrt
from typing import Iterable, Mapping, Sequence
import unicodedata

from .contract import DAY_MS, MAX_SAMPLE, MIN_SAMPLE, N_REF


DEFAULT_COMPONENTS = (
    "Lula",
    "Flávio Bolsonaro",
    "Augusto Cury",
    "Renan Santos",
    "Ronaldo Caiado",
    "Romeu Zema",
)


@dataclass(frozen=True)
class CompositionPoll:
    t: float
    y: dict[str, float]
    n: float
    institute: str


@dataclass(frozen=True)
class CompositionForecast:
    target_t: float
    values: dict[str, float]
    residual: float


@dataclass(frozen=True)
class CompositionMetric:
    model: str
    horizon_days: int
    n: int
    mae: float
    rmse: float
    simplex_error: float


def _key(value: object) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn").casefold().strip()


def _sample_size(n: float) -> float:
    return min(MAX_SAMPLE, max(MIN_SAMPLE, n)) if n > 0 else 800.0


def _poll_vector(row: Mapping[str, object], components: Sequence[str]) -> CompositionPoll | None:
    end = str(row.get("fieldwork_end") or row.get("published_date") or "")[:10]
    try:
        t = datetime.fromisoformat(end).replace(tzinfo=timezone.utc).timestamp() * 1000
    except ValueError:
        return None

    lookup = {_key(component): component for component in components}
    raw: dict[str, float] = {}
    for candidate in row.get("candidates") or []:
        canonical = lookup.get(_key(candidate.get("name")))
        if canonical is None:
            continue
        try:
            value = float(candidate.get("pct"))
        except (TypeError, ValueError):
            return None
        raw[canonical] = value

    if any(component not in raw for component in components):
        return None
    residual = 100.0 - sum(raw.values())
    if residual <= 0.25:
        return None
    raw["__residual__"] = residual
    return CompositionPoll(t=t, y=raw, n=float(row.get("n") or 0), institute=str(row.get("institute") or ""))


def load_composition_polls(
    rows: Iterable[Mapping[str, object]],
    *,
    components: Sequence[str] = DEFAULT_COMPONENTS,
) -> list[CompositionPoll]:
    out: list[CompositionPoll] = []
    for row in rows:
        scenario = _key(row.get("scenario"))
        if "1o turno" not in scenario and "1 turno" not in scenario and "primeiro turno" not in scenario and "estimulada" not in scenario:
            continue
        poll = _poll_vector(row, components)
        if poll is not None:
            out.append(poll)
    return sorted(out, key=lambda point: point.t)


def _weight(point: CompositionPoll, t: float, half_life_days: float = 14.0) -> float:
    days = abs(t - point.t) / DAY_MS
    return sqrt(_sample_size(point.n) / N_REF) * 2 ** (-days / max(1.0, half_life_days))


def _ratio(point: CompositionPoll, candidate: str) -> float:
    return log(max(0.25, point.y[candidate]) / max(0.25, point.y["__residual__"]))


def _ratio_series(
    points: Sequence[CompositionPoll],
    candidate: str,
    *,
    half_life_days: float = 14.0,
) -> list[tuple[float, float]]:
    dates = sorted({point.t for point in points})
    out: list[tuple[float, float]] = []
    for t in dates:
        rows = [point for point in points if point.t == t]
        weighted = [(_ratio(point, candidate), _weight(point, t, half_life_days)) for point in rows]
        den = sum(weight for _, weight in weighted)
        if den > 0:
            out.append((t, sum(value * weight for value, weight in weighted) / den))
    return out


def forecast_composition(
    points: Sequence[CompositionPoll],
    origin: float,
    horizon_days: int,
    *,
    components: Sequence[str] = DEFAULT_COMPONENTS,
    fit_days: int = 14,
) -> CompositionForecast | None:
    forecast_ratios: dict[str, float] = {}
    cut = origin - fit_days * DAY_MS
    history = [point for point in points if cut <= point.t <= origin]
    if len({point.t for point in history}) < 3:
        return None

    for candidate in components:
        series = _ratio_series(history, candidate)
        if len(series) < 3:
            return None
        t0 = series[0][0]
        xs = [(x - t0) / DAY_MS for x, _ in series]
        ys = [y for _, y in series]
        n = len(xs)
        sx, sy = sum(xs), sum(ys)
        sxx = sum(x * x for x in xs)
        sxy = sum(x * y for x, y in zip(xs, ys))
        denominator = n * sxx - sx * sx
        slope = 0.0 if abs(denominator) < 1e-9 else (n * sxy - sx * sy) / denominator
        slope = max(-0.30, min(0.30, slope))
        intercept = (sy - slope * sx) / n
        target_x = (origin + horizon_days * DAY_MS - t0) / DAY_MS
        forecast_ratios[candidate] = intercept + slope * target_x

    base = max(forecast_ratios.values())
    scales = {candidate: exp(ratio - base) for candidate, ratio in forecast_ratios.items()}
    denominator = 1.0 + sum(scales.values())
    values = {candidate: 100.0 * scale / denominator for candidate, scale in scales.items()}
    return CompositionForecast(
        target_t=origin + horizon_days * DAY_MS,
        values=values,
        residual=100.0 / denominator,
    )


def _actual_composition(
    points: Sequence[CompositionPoll],
    target: float,
    *,
    components: Sequence[str],
) -> dict[str, float] | None:
    rows = [point for point in points if point.t == target]
    if not rows:
        return None
    result = {candidate: sum(point.y[candidate] for point in rows) / len(rows) for candidate in components}
    result["__residual__"] = sum(point.y["__residual__"] for point in rows) / len(rows)
    return result


def _independent_forecast(
    points: Sequence[CompositionPoll],
    origin: float,
    *,
    components: Sequence[str],
) -> tuple[dict[str, float], float] | None:
    history = [point for point in points if point.t <= origin]
    predicted: dict[str, float] = {}
    for candidate in components:
        terms = [(_weight(point, origin) * point.y[candidate], _weight(point, origin)) for point in history]
        den = sum(weight for _, weight in terms)
        if den <= 0:
            return None
        predicted[candidate] = sum(value for value, _ in terms) / den
    residual = max(0.0, 100.0 - sum(predicted.values()))
    total = sum(predicted.values()) + residual
    scale = 100.0 / max(1e-9, total)
    return {key: value * scale for key, value in predicted.items()}, residual * scale


def _record_metrics(
    model: str,
    horizon: int,
    rows: list[tuple[float, float, float]],
) -> CompositionMetric | None:
    if not rows:
        return None
    signed = [predicted - actual for predicted, actual, _ in rows]
    simplex = [error for _, _, error in rows]
    return CompositionMetric(
        model=model,
        horizon_days=horizon,
        n=len(rows),
        mae=sum(abs(error) for error in signed) / len(signed),
        rmse=sqrt(sum(error * error for error in signed) / len(signed)),
        simplex_error=sum(simplex) / len(simplex),
    )


def rolling_composition_backtest(
    points: Iterable[CompositionPoll],
    *,
    components: Sequence[str] = DEFAULT_COMPONENTS,
    horizons: Sequence[int] = (1, 3, 7),
    min_history_dates: int = 6,
) -> list[CompositionMetric]:
    rows = sorted(points, key=lambda point: point.t)
    dates = sorted({point.t for point in rows})
    if len(dates) < min_history_dates:
        return []

    output: list[CompositionMetric] = []
    for model in ("joint-alr", "independent-renormalized"):
        for horizon in horizons:
            errors: list[tuple[float, float, float]] = []
            for origin in dates[min_history_dates - 1 :]:
                targets = [target for target in dates if target >= origin + horizon * DAY_MS]
                if not targets:
                    continue
                target = targets[0]
                actual = _actual_composition(rows, target, components=components)
                if actual is None:
                    continue

                if model == "joint-alr":
                    forecast = forecast_composition(rows, origin, horizon, components=components)
                    if forecast is None:
                        continue
                    predicted = forecast.values
                    residual = forecast.residual
                else:
                    baseline = _independent_forecast(rows, origin, components=components)
                    if baseline is None:
                        continue
                    predicted, residual = baseline

                errors.extend(
                    (predicted[candidate], actual[candidate], 0.0)
                    for candidate in components
                )
                errors.append((residual, actual["__residual__"], abs(sum(predicted.values()) + residual - 100.0)))

            metric = _record_metrics(model, horizon, errors)
            if metric is not None:
                output.append(metric)
    return output
