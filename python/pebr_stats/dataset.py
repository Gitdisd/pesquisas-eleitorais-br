from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import json
import unicodedata
from typing import Any, Iterable

from .contract import PollObservation


DAY_MS = 86_400_000


def _key(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn").lower().strip()


def _timestamp(value: Any) -> float | None:
    text = str(value or "")[:10]
    try:
        dt = datetime.fromisoformat(text).replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    return dt.timestamp() * 1000


def load_poll_rows(path: str | Path) -> list[dict[str, Any]]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    return list(payload.get("polls", []))


def candidate_series(
    rows: Iterable[dict[str, Any]],
    *,
    candidates: tuple[str, ...] = ("Lula", "Flávio Bolsonaro"),
) -> dict[tuple[str, str], list[PollObservation]]:
    wanted = {_key(name): name for name in candidates}
    groups: dict[tuple[str, str], list[PollObservation]] = defaultdict(list)

    for row in rows:
        scenario = str(row.get("scenario") or "").strip()
        if not scenario:
            continue
        t = _timestamp(row.get("fieldwork_end") or row.get("published_date"))
        if t is None:
            continue
        n = row.get("n", 0)
        try:
            sample = float(n)
        except (TypeError, ValueError):
            sample = 0.0

        for candidate in row.get("candidates") or []:
            name = _key(candidate.get("name"))
            canonical = wanted.get(name)
            if canonical is None:
                continue
            try:
                pct = float(candidate.get("pct"))
            except (TypeError, ValueError):
                continue
            groups[(scenario, canonical)].append(
                PollObservation(
                    t=t,
                    y=pct,
                    n=sample,
                    institute=str(row.get("institute") or ""),
                    moe=None,
                )
            )

    for observations in groups.values():
        observations.sort(key=lambda item: (item.t, item.institute))
    return dict(groups)
