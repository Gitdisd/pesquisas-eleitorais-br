from pebr_stats.backtest import rolling_origin, summarize
from pebr_stats.contract import PollObservation

DAY = 86_400_000

def test_rolling_origin_produces_baseline_metrics():
    points = [
        PollObservation(t=i * DAY, y=40 + i)
        for i in range(12)
    ]
    rows = rolling_origin(points, horizons=(1, 3), min_history=5)
    metrics = summarize(rows)
    assert metrics
    assert {m.model for m in metrics} == {"persistence", "canonical-weighted"}
    assert {m.horizon_days for m in metrics} == {1, 3}
    assert all(m.n > 0 and m.mae >= 0 and m.rmse >= 0 for m in metrics)


def test_rolling_origin_aggregates_same_day_observations():
    points = [
        PollObservation(t=0, y=40),
        PollObservation(t=DAY, y=42),
        PollObservation(t=DAY, y=50),
        PollObservation(t=2 * DAY, y=44),
        PollObservation(t=3 * DAY, y=46),
        PollObservation(t=4 * DAY, y=48),
    ]
    rows = rolling_origin(points, horizons=(1,), min_history=3)
    match = [
        r for r in rows
        if r.origin == DAY and r.horizon_days == 1 and r.model == "persistence"
    ]
    assert match
    assert match[0].actual == 44
    assert match[0].predicted == 46
