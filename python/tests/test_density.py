from pebr_stats.density import calibrate_by_density


def test_density_calibration_uses_temporal_holdout():
    rows = [
        {"origin": i, "horizon_days": 1, "actual": 40 + i, "predicted": 40 + i + (0.5 if i < 7 else 4), "density": i + 1}
        for i in range(12)
    ]
    result = calibrate_by_density(rows, target_coverage=0.90, calibration_fraction=0.70)
    assert result
    assert all(item.validation_n > 0 for item in result)
    assert all(item.horizon_days == 1 for item in result)
