from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import Iterable, Mapping, Sequence


@dataclass(frozen=True)
class DensityCalibration:
    horizon_days: int
    density_bin: str
    calibration_n: int
    validation_n: int
    target_coverage: float
    half_width: float
    validation_coverage: float
    validation_mae: float


def _quantile(values: Sequence[float], probability: float) -> float:
    if not values:
        raise ValueError("quantile requires at least one value")
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * max(0.0, min(1.0, probability))
    lo = int(position)
    hi = min(lo + 1, len(ordered) - 1)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (position - lo)


def _bin_for(value: float, low_cut: float, high_cut: float) -> str:
    if value <= low_cut:
        return "low"
    if value <= high_cut:
        return "medium"
    return "high"


def calibrate_by_density(
    rows: Iterable[Mapping[str, object]],
    *,
    target_coverage: float = 0.90,
    calibration_fraction: float = 0.70,
) -> list[DensityCalibration]:
    grouped: dict[int, list[Mapping[str, object]]] = {}
    for row in rows:
        try:
            horizon = int(row["horizon_days"])
            float(row["origin"])
            float(row["actual"])
            float(row["predicted"])
            float(row["density"])
        except (KeyError, TypeError, ValueError):
            continue
        grouped.setdefault(horizon, []).append(row)

    output: list[DensityCalibration] = []
    for horizon, group in sorted(grouped.items()):
        origins = sorted({float(row["origin"]) for row in group})
        if len(origins) < 6:
            continue
        cut_index = max(1, min(len(origins) - 1, int(len(origins) * calibration_fraction)))
        cutoff = origins[cut_index - 1]
        calibration = [row for row in group if float(row["origin"]) <= cutoff]
        validation = [row for row in group if float(row["origin"]) > cutoff]
        if len(calibration) < 6 or not validation:
            continue

        densities = sorted(float(row["density"]) for row in calibration)
        low_cut = _quantile(densities, 1 / 3)
        high_cut = _quantile(densities, 2 / 3)

        for density_bin in ("low", "medium", "high"):
            cal_rows = [
                row for row in calibration
                if _bin_for(float(row["density"]), low_cut, high_cut) == density_bin
            ]
            val_rows = [
                row for row in validation
                if _bin_for(float(row["density"]), low_cut, high_cut) == density_bin
            ]
            if not cal_rows or not val_rows:
                continue

            errors = [
                abs(float(row["predicted"]) - float(row["actual"]))
                for row in cal_rows
            ]
            width = _quantile(errors, target_coverage)
            val_errors = [
                abs(float(row["predicted"]) - float(row["actual"]))
                for row in val_rows
            ]
            coverage = sum(error <= width + 1e-12 for error in val_errors) / len(val_errors)
            output.append(
                DensityCalibration(
                    horizon_days=horizon,
                    density_bin=density_bin,
                    calibration_n=len(cal_rows),
                    validation_n=len(val_rows),
                    target_coverage=target_coverage,
                    half_width=width,
                    validation_coverage=coverage,
                    validation_mae=sum(val_errors) / len(val_errors),
                )
            )
    return output
