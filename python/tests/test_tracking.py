from pebr_stats.tracking import (
    TrackingPoll,
    overlap_pair_count,
    tracking_design_effect,
    tracking_weighted_mean,
)


def poll(start, end, y, institute="Example"):
    return TrackingPoll(
        institute=institute,
        scenario="estimulada 1o turno",
        geo="BR",
        start=start,
        end=end,
        y=y,
        n=2000,
    )


def test_overlap_fraction_increases_design_effect_only_when_rho_is_positive():
    left = poll(0, 4, 40)
    right = poll(3, 7, 42)

    assert overlap_pair_count([left, right]) == 1
    assert tracking_design_effect(left, [left, right], rho=0) == 1
    assert tracking_design_effect(left, [left, right], rho=0.5) > 1


def test_zero_rho_matches_the_independent_weighted_mean():
    rows = [poll(0, 0, 40), poll(1, 1, 50)]
    estimate = tracking_weighted_mean(rows, 1, rho=0)
    assert estimate is not None
    assert 40 < estimate < 50


def test_non_matching_institute_does_not_create_overlap_exposure():
    left = poll(0, 4, 40, "A")
    right = poll(3, 7, 42, "B")
    assert overlap_pair_count([left, right]) == 0
    assert tracking_design_effect(left, [left, right], rho=0.75) == 1
