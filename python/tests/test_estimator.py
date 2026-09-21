import json
from datetime import datetime, timezone
from pathlib import Path
from pebr_stats.contract import PollObservation
from pebr_stats.estimator import weighted_estimate

FIXTURE = Path(__file__).parent / "fixtures" / "real_lula.json"

def ms(s):
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc).timestamp() * 1000

def test_real_fixture_matches_reference():
    rows = json.loads(FIXTURE.read_text())
    points = [PollObservation(t=ms(r["t"]), y=r["y"], n=r["n"], institute=r["institute"]) for r in rows]
    result = weighted_estimate(points, date=ms("2026-09-19"), candidate="lula")
    assert result.estimate is not None
    assert round(result.estimate, 6) == 39.844919
    assert round(result.effective_sample_size, 6) == 7.627807
    assert result.lower is None and result.upper is None
