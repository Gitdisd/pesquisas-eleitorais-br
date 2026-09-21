from pebr_stats.engine import Observation, sample_size, weighted_mean


def test_sample_size_cap():
    assert sample_size(9000) == 4000
    assert sample_size(50) == 100


def test_weighted_mean_prefers_recent_observation():
    rows = [
        Observation(t=0, y=40, n=2000),
        Observation(t=86_400_000 * 14, y=50, n=2000),
    ]
    value = weighted_mean(rows, 86_400_000 * 14)
    assert value is not None
    assert value > 45
