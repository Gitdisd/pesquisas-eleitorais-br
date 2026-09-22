from pebr_stats.multifold_projection_calibration import rolling_temporal_calibration, summarize_validation_coverage
from pebr_stats.projection_calibration import ProjectionBacktestPoint


def test_multifold_calibration_uses_only_prior_origins():
    rows = []
    for origin, err in enumerate([1.0, 1.2, 1.4, 1.6, 2.0, 2.2, 4.0, 4.2, 4.4, 4.6, 5.0, 5.2]):
        rows.append(
            ProjectionBacktestPoint(
                origin=float(origin),
                horizon_days=7,
                actual=0.0,
                predicted=err,
                half_width=2.0,
                scenario="s",
                candidate="c",
            )
        )

    folds = rolling_temporal_calibration(
        rows,
        target_coverage=0.90,
        fold_count=3,
        min_calibration_origins=5,
    )

    assert len(folds) == 3
    assert all(fold.calibration_n >= 5 for fold in folds)
    assert folds[0].calibration_n == 5
    assert folds[0].validation_n == 2
    assert folds[-1].validation_n == 3
    assert all(fold.fold == i + 1 for i, fold in enumerate(folds))

    summary = summarize_validation_coverage(folds)
    assert summary[7]["folds"] == 3
    assert summary[7]["validation_n"] == 7
    assert 0.0 <= summary[7]["pooled_validation_coverage"] <= 1.0


def test_multifold_does_not_require_future_origins_for_calibration():
    rows = [
        ProjectionBacktestPoint(
            origin=float(i),
            horizon_days=1,
            actual=0.0,
            predicted=float(i + 1),
            half_width=1.0,
            scenario="s",
            candidate="c",
        )
        for i in range(8)
    ]
    folds = rolling_temporal_calibration(rows, fold_count=2, min_calibration_origins=4)
    assert folds
    assert all(fold.calibration_n >= 4 for fold in folds)
