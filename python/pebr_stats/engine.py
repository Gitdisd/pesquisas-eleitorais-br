from __future__ import annotations

from .contract import PollObservation, poll_weight, sample_size, weighted_mean

# Backward-compatible alias for existing research imports.
Observation = PollObservation

__all__ = ["Observation", "PollObservation", "poll_weight", "sample_size", "weighted_mean"]
