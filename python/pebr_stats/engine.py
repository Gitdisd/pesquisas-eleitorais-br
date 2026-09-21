from __future__ import annotations

from dataclasses import dataclass
from math import exp, sqrt
from typing import Iterable

DAY_MS = 86_400_000
N_REF = 2_000
MAX_SAMPLE = 4_000

@dataclass(frozen=True)
class Observation:
    t: float
    y: float
    n: float = 800.0
    institute: str | None = None

def sample_size(n: float) -> float:
    if n > 0:
        return min(MAX_SAMPLE, max(100.0, n))
    return 800.0

def poll_weight(point: Observation, t: float, half_life_days: float = 14.0) -> float:
    days = abs(t - point.t) / DAY_MS
    half = max(1.0, half_life_days)
    return sqrt(sample_size(point.n) / N_REF) * exp(-days / half)

def weighted_mean(points: Iterable[Observation], t: float, half_life_days: float = 14.0) -> float | None:
    rows = [p for p in points if p.y == p.y]
    if not rows:
        return None
    weights = [poll_weight(p, t, half_life_days) for p in rows]
    denominator = sum(weights)
    if denominator <= 0:
        return None
    return sum(w * p.y for w, p in zip(weights, rows)) / denominator
