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


def test_projection_v2_calibration_uses_temporal_holdout():
    from pebr_stats.projection_v2_backtest import ProjectionV2BacktestPoint, calibrate_projection_v2

    rows = [
        ProjectionV2BacktestPoint(
            origin=float(i),
            horizon_days=1,
            target_date=float(i + 1),
            target_lag_days=0.0,
            actual=40.0 + i,
            predicted=40.0 + i + (0.5 if i < 7 else 4.0),
            half_width=1.0,
            persistence=40.0 + i,
            scenario="s",
            candidate="Lula",
        )
        for i in range(12)
    ]
    result = calibrate_projection_v2(rows, target_coverage=0.90, calibration_fraction=0.70)
    assert result
    assert all(item.validation_n > 0 for item in result)
