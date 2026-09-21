from __future__ import annotations

import json

from pebr_stats.dataset import candidate_series


def test_candidate_series_groups_by_scenario_and_candidate():
    rows = [
        {
            "scenario": "estimulada 1º turno",
            "fieldwork_end": "2026-09-10",
            "institute": "A",
            "n": 1000,
            "candidates": [{"name": "Lula", "pct": 40}, {"name": "Flávio Bolsonaro", "pct": 30}],
        },
        {
            "scenario": "2º turno Lula x Flávio Bolsonaro",
            "fieldwork_end": "2026-09-11",
            "institute": "B",
            "n": 2000,
            "candidates": [{"name": "Lula", "pct": 45}, {"name": "Flávio Bolsonaro", "pct": 40}],
        },
    ]
    groups = candidate_series(rows)
    assert set(groups) == {
        ("estimulada 1º turno", "Lula"),
        ("estimulada 1º turno", "Flávio Bolsonaro"),
        ("2º turno Lula x Flávio Bolsonaro", "Lula"),
        ("2º turno Lula x Flávio Bolsonaro", "Flávio Bolsonaro"),
    }
    assert groups[("estimulada 1º turno", "Lula")][0].y == 40
    assert groups[("2º turno Lula x Flávio Bolsonaro", "Flávio Bolsonaro")][0].n == 2000
