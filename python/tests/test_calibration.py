from pebr_stats.backtest import BacktestPoint
from pebr_stats.calibration import calibrate_empirical_intervals


def test_empirical_interval_calibration_hits_target_quantile():
    rows = [
        BacktestPoint(origin=float(i), horizon_days=1, actual=0.0, predicted=float(i), model="canonical-weighted")
        for i in range(1, 11)
    ]
    result = calibrate_empirical_intervals(rows, target_coverage=0.90)
    assert len(result) == 1
    item = result[0]
    assert item.model == "canonical-weighted"
    assert item.horizon_days == 1
    assert item.n == 10
    assert item.half_width == 9.1
    assert item.empirical_coverage == 0.9


def test_empirical_interval_calibration_can_select_model():
    rows = [
        BacktestPoint(origin=0, horizon_days=1, actual=10, predicted=11, model="a"),
        BacktestPoint(origin=1, horizon_days=1, actual=10, predicted=12, model="a"),
        BacktestPoint(origin=0, horizon_days=1, actual=10, predicted=14, model="b"),
        BacktestPoint(origin=1, horizon_days=1, actual=10, predicted=16, model="b"),
    ]
    result = calibrate_empirical_intervals(rows, model="a")
    assert len(result) == 1
    assert result[0].n == 2
