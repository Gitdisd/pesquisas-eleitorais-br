from pebr_stats.backtest import BacktestPoint
from pebr_stats.projection_calibration import calibrate_projection, project_trend


def test_project_trend_is_anchored_to_last_observation():
    day = 86_400_000
    series = [(0, 40.0), (day, 40.0), (2 * day, 40.0), (3 * day, 40.0)]
    projection = project_trend(series, horizon_days=2)
    assert projection[0] == (3 * day, 40.0, 0.0)
    assert [point[1] for point in projection[1:]] == [40.0, 40.0]
    assert projection[1][2] >= 1.645 * 2.0


def test_calibrate_projection_uses_only_earlier_origins():
    rows = []
    for i, err in enumerate([1.0, 1.2, 1.5, 1.8, 2.0, 2.2, 4.0, 4.5, 5.0, 5.5]):
        rows.append(
            __import__("pebr_stats.projection_calibration", fromlist=["ProjectionBacktestPoint"]).ProjectionBacktestPoint(
                origin=float(i),
                horizon_days=7,
                actual=0.0,
                predicted=err,
                half_width=2.0,
                scenario="s",
                candidate="c",
            )
        )
    result = calibrate_projection(rows, target_coverage=0.90, calibration_fraction=0.70)
    assert len(result) == 1
    item = result[0]
    assert item.calibration_n == 7
    assert item.validation_n == 3
    assert item.scale_factor > 1.0
    assert item.validation_coverage < item.calibration_coverage
