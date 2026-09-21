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
