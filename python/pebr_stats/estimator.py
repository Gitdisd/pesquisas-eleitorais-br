from __future__ import annotations
from dataclasses import dataclass
from typing import Iterable
from .contract import PollObservation, poll_weight

@dataclass(frozen=True)
class EstimatorResult:
    date: float
    candidate: str
    estimate: float | None
    lower: float | None
    upper: float | None
    effective_sample_size: float

def weighted_estimate(points: Iterable[PollObservation], *, date: float, candidate: str, half_life_days: float = 14.0) -> EstimatorResult:
    rows = [p for p in points if p.y == p.y]
    if not rows:
        return EstimatorResult(date, candidate, None, None, None, 0.0)
    weights = [poll_weight(p, date, half_life_days).total for p in rows]
    den = sum(weights)
    if den <= 0:
        return EstimatorResult(date, candidate, None, None, None, 0.0)
    estimate = sum(w * p.y for w, p in zip(weights, rows)) / den
    sum_w2 = sum(w * w for w in weights)
    effective = den * den / sum_w2 if sum_w2 > 0 else 0.0
    return EstimatorResult(date, candidate, estimate, None, None, effective)
