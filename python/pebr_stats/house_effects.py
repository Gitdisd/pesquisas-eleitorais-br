from __future__ import annotations

from math import sqrt
from typing import Sequence

from .contract import DAY_MS, N_REF, PollObservation, sample_size


def estimate_house_effects(
    points: Sequence[PollObservation],
    *,
    peer_days: int = 14,
) -> dict[str, float]:
    """Estimate institute house effects using temporally proximate peer polls.

    The estimator intentionally shares the canonical sample-size cap and
    reference sample size from the statistical contract.
    """
    acc: dict[str, list[float]] = {}
    for point in points:
        if point.y != point.y or not point.institute:
            continue
        numerator = 0.0
        denominator = 0.0
        for peer in points:
            if peer.y != peer.y or not peer.institute or peer.institute == point.institute:
                continue
            days = abs(peer.t - point.t) / DAY_MS
            if days > peer_days:
                continue
            weight = sqrt(sample_size(peer.n) / N_REF)
            numerator += weight * peer.y
            denominator += weight
        if denominator <= 0:
            continue
        bucket = acc.setdefault(point.institute, [0.0, 0.0])
        bucket[0] += point.y - numerator / denominator
        bucket[1] += 1.0

    out: dict[str, float] = {}
    for institute, (total, count) in acc.items():
        raw = total / count
        out[institute] = 0.0 if abs(raw) < 0.05 else raw * (count / (count + 4.0))
    return out
