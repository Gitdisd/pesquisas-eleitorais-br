from __future__ import annotations

from dataclasses import dataclass
from math import sqrt

DAY_MS = 86_400_000
N_REF = 2_000
MIN_SAMPLE = 100
MAX_SAMPLE = 4_000

@dataclass(frozen=True)
class PollObservation:
    t: float
    y: float
    n: float = 800.0
    institute: str | None = None
    moe: float | None = None

@dataclass(frozen=True)
class PollWeight:
    total: float
    sample: float
    recency: float
    flood: float = 1.0

def sample_size(n: float) -> float:
    if n > 0:
        return min(MAX_SAMPLE, max(MIN_SAMPLE, n))
    return 800.0

def poll_weight(point: PollObservation, t: float, half_life_days: float = 14.0, flood_count: int = 1) -> PollWeight:
    days = abs(t - point.t) / DAY_MS
    half = max(1.0, float(half_life_days))
    sample = sqrt(sample_size(point.n) / N_REF)
    recency = 2.0 ** (-days / half)
    flood = max(1, int(flood_count))
    return PollWeight(sample * recency / flood, sample, recency, float(flood))

def weighted_mean(points: list[PollObservation], t: float, half_life_days: float = 14.0) -> float | None:
    rows = [p for p in points if p.y == p.y]
    if not rows:
        return None
    weights = [poll_weight(p, t, half_life_days).total for p in rows]
    den = sum(weights)
    return None if den <= 0 else sum(w * p.y for w, p in zip(weights, rows)) / den
