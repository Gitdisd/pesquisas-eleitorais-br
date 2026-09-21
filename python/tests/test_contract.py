from pebr_stats.contract import PollObservation, sample_size, poll_weight, weighted_mean


def test_canonical_sample_cap():
    assert sample_size(9000) == 4000
    assert sample_size(50) == 100
    assert sample_size(0) == 800


def test_python_weighted_mean_fixture():
    rows = [
        PollObservation(t=0, y=40, n=2000),
        PollObservation(t=86_400_000 * 7, y=50, n=4000),
        PollObservation(t=86_400_000 * 14, y=45, n=1000),
    ]
    value = weighted_mean(rows, 86_400_000 * 7, 14)
    assert value is not None
    assert round(value, 6) == 46.079428
