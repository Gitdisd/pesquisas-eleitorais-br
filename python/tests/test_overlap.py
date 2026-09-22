from pebr_stats.overlap import find_fieldwork_overlaps, summarize_overlaps


def test_detects_same_institute_overlapping_fieldwork():
    rows = [
        {
            "institute": "Example",
            "scenario": "estimulada 1º turno",
            "fieldwork_start": "2026-09-01",
            "fieldwork_end": "2026-09-04",
        },
        {
            "institute": "Example",
            "scenario": "estimulada 1º turno",
            "fieldwork_start": "2026-09-04",
            "fieldwork_end": "2026-09-12",
        },
        {
            "institute": "Other",
            "scenario": "estimulada 1º turno",
            "fieldwork_start": "2026-09-02",
            "fieldwork_end": "2026-09-08",
        },
    ]

    overlaps = find_fieldwork_overlaps(rows)

    assert len(overlaps) == 1
    assert overlaps[0].overlap_days == 1
    assert overlaps[0].institute == "Example"


def test_summary_tracks_max_and_total_overlap_duration():
    rows = [
        {
            "institute": "Example",
            "scenario": "s",
            "fieldwork_start": "2026-09-01",
            "fieldwork_end": "2026-09-05",
        },
        {
            "institute": "Example",
            "scenario": "s",
            "fieldwork_start": "2026-09-03",
            "fieldwork_end": "2026-09-06",
        },
        {
            "institute": "Example",
            "scenario": "s",
            "fieldwork_start": "2026-09-06",
            "fieldwork_end": "2026-09-07",
        },
    ]

    summary = summarize_overlaps(rows)

    assert summary["overlap_pair_count"] == 2
    assert summary["max_overlap_days"] == 3
    assert summary["total_overlap_days"] == 5
