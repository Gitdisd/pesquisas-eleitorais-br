from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence

from .projection_calibration import ProjectionBacktestPoint, _quantile


@dataclass(frozen=True)
class ProjectionCalibrationFold:
    horizon_days: int
    fold: int
    calibration_n: int
    validation_n: int
    target_coverage: float
    scale_factor: float
    calibration_coverage: float
    validation_coverage: float


def rolling_temporal_calibration(
    rows: Iterable[ProjectionBacktestPoint],
    *,
    target_coverage: float = 0.90,
    fold_count: int = 3,
    min_calibration_origins: int = 5,
) -> list[ProjectionCalibrationFold]:
    grouped: dict[int, list[ProjectionBacktestPoint]] = {}
    for row in rows:
        grouped.setdefault(row.horizon_days, []).append(row)

    out: list[ProjectionCalibrationFold] = []
    for horizon, group in sorted(grouped.items()):
        origins = sorted({row.origin for row in group})
        if len(origins) < min_calibration_origins + fold_count:
            continue

        remaining = len(origins) - min_calibration_origins
        fold_size = max(1, remaining // fold_count)
        for fold in range(fold_count):
            start = min_calibration_origins + fold * fold_size
            if start >= len(origins):
                break
            end = len(origins) if fold == fold_count - 1 else min(len(origins), start + fold_size)
            validation_origins = set(origins[start:end])
            calibration = [row for row in group if row.origin < origins[start]]
            validation = [row for row in group if row.origin in validation_origins]
            if not calibration or not validation:
                continue

            ratios = [
                abs(row.predicted - row.actual) / row.half_width
                for row in calibration
                if row.half_width > 0
            ]
            if not ratios:
                continue
            factor = _quantile(ratios, target_coverage)
            calibration_coverage = sum(
                abs(row.predicted - row.actual) <= factor * row.half_width + 1e-12
                for row in calibration
            ) / len(calibration)
            validation_coverage = sum(
                abs(row.predicted - row.actual) <= factor * row.half_width + 1e-12
                for row in validation
            ) / len(validation)

            out.append(
                ProjectionCalibrationFold(
                    horizon_days=horizon,
                    fold=fold + 1,
                    calibration_n=len(calibration),
                    validation_n=len(validation),
                    target_coverage=target_coverage,
                    scale_factor=factor,
                    calibration_coverage=calibration_coverage,
                    validation_coverage=validation_coverage,
                )
            )
    return out


def summarize_validation_coverage(
    folds: Sequence[ProjectionCalibrationFold],
) -> dict[int, dict[str, float | int | None]]:
    out: dict[int, dict[str, float | int | None]] = {}
    for horizon in sorted({fold.horizon_days for fold in folds}):
        group = [fold for fold in folds if fold.horizon_days == horizon]
        validation_n = sum(fold.validation_n for fold in group)
        weighted_coverage = (
            sum(fold.validation_coverage * fold.validation_n for fold in group) / validation_n
            if validation_n
            else None
        )
        out[horizon] = {
            "folds": len(group),
            "validation_n": validation_n,
            "pooled_validation_coverage": weighted_coverage,
            "mean_scale_factor": (
                sum(fold.scale_factor for fold in group) / len(group) if group else None
            ),
            "min_scale_factor": min((fold.scale_factor for fold in group), default=None),
            "max_scale_factor": max((fold.scale_factor for fold in group), default=None),
        }
    return out
