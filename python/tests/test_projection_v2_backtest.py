from pebr_stats.contract import PollObservation
from pebr_stats.projection_v2_backtest import rolling_projection_v2_backtest, summarize_projection_v2


def test_projection_v2_backtest_tracks_gate_and_scores():
    day = 86_400_000
    points = [
        PollObservation(t=i * 2 * day, y=40.0 + 0.25 * i, n=2000, institute="A")
        for i in range(40)
    ]

    result = rolling_projection_v2_backtest(
        points,
        scenario="s",
        candidate="c",
        horizons=(1, 3, 7),
    )

    assert result.gate.eligible_origins > 0
    assert 0 <= result.gate.gate_pass_origins <= result.gate.eligible_origins
    assert 0.0 <= result.gate.pass_rate <= 1.0
    assert result.rows

    metrics = summarize_projection_v2(result)
    assert {metric.horizon_days for metric in metrics} == {1, 3, 7}
    assert all(metric.n > 0 for metric in metrics)
    assert all(0.0 <= metric.nominal_interval_coverage <= 1.0 for metric in metrics)
    assert any(row.target_lag_days > 0 for row in result.rows)
