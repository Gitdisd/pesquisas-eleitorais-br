from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Iterable, Mapping, Sequence


@dataclass(frozen=True)
class FieldworkWindow:
    poll_key: str
    institute: str
    scenario: str
    fieldwork_start: date
    fieldwork_end: date


@dataclass(frozen=True)
class FieldworkOverlap:
    left_key: str
    right_key: str
    institute: str
    scenario: str
    overlap_days: int


def _parse_date(value: object) -> date | None:
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def fieldwork_windows(rows: Iterable[Mapping[str, object]]) -> list[FieldworkWindow]:
    out: list[FieldworkWindow] = []
    for row in rows:
        institute = str(row.get("institute") or "").strip()
        scenario = str(row.get("scenario") or "").strip()
        start = _parse_date(row.get("fieldwork_start"))
        end = _parse_date(row.get("fieldwork_end"))
        if not institute or not scenario or start is None or end is None or end < start:
            continue

        identity = "|".join(
            [
                institute.casefold(),
                str(row.get("fieldwork_start") or "")[:10],
                str(row.get("fieldwork_end") or "")[:10],
                scenario.casefold(),
                str(row.get("geo") or "BR").strip().casefold(),
            ]
        )
        out.append(
            FieldworkWindow(
                poll_key=identity,
                institute=institute,
                scenario=scenario,
                fieldwork_start=start,
                fieldwork_end=end,
            )
        )
    return out


def find_fieldwork_overlaps(
    rows: Sequence[Mapping[str, object]],
) -> list[FieldworkOverlap]:
    windows = fieldwork_windows(rows)
    grouped: dict[tuple[str, str], list[FieldworkWindow]] = {}
    for window in windows:
        grouped.setdefault((window.institute.casefold(), window.scenario.casefold()), []).append(window)

    overlaps: list[FieldworkOverlap] = []
    for group in grouped.values():
        ordered = sorted(group, key=lambda item: (item.fieldwork_start, item.fieldwork_end, item.poll_key))
        for index, left in enumerate(ordered):
            for right in ordered[index + 1 :]:
                if right.fieldwork_start > left.fieldwork_end:
                    break
                overlap_start = max(left.fieldwork_start, right.fieldwork_start)
                overlap_end = min(left.fieldwork_end, right.fieldwork_end)
                if overlap_end < overlap_start or left.poll_key == right.poll_key:
                    continue
                overlaps.append(
                    FieldworkOverlap(
                        left_key=left.poll_key,
                        right_key=right.poll_key,
                        institute=left.institute,
                        scenario=left.scenario,
                        overlap_days=(overlap_end - overlap_start).days + 1,
                    )
                )
    return sorted(overlaps, key=lambda item: (-item.overlap_days, item.institute, item.scenario))


def summarize_overlaps(rows: Sequence[Mapping[str, object]]) -> dict[str, object]:
    overlaps = find_fieldwork_overlaps(rows)
    return {
        "overlap_pair_count": len(overlaps),
        "institutes": sorted({item.institute for item in overlaps}),
        "scenarios": sorted({item.scenario for item in overlaps}),
        "max_overlap_days": max((item.overlap_days for item in overlaps), default=0),
        "total_overlap_days": sum(item.overlap_days for item in overlaps),
        "pairs": [
            {
                "left_key": item.left_key,
                "right_key": item.right_key,
                "institute": item.institute,
                "scenario": item.scenario,
                "overlap_days": item.overlap_days,
            }
            for item in overlaps
        ],
    }
