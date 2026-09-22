from pebr_stats.contract import PollObservation
from pebr_stats.house_effects import estimate_house_effects


def test_house_effects_use_canonical_sample_cap():
    day = 86_400_000
    capped = [
        PollObservation(t=0, y=50.0, n=40500, institute="A"),
        PollObservation(t=day, y=40.0, n=2000, institute="B"),
    ]
    exact_cap = [
        PollObservation(t=0, y=50.0, n=4000, institute="A"),
        PollObservation(t=day, y=40.0, n=2000, institute="B"),
    ]

    assert estimate_house_effects(capped) == estimate_house_effects(exact_cap)
    assert estimate_house_effects(capped)["A"] == 2.0
    assert estimate_house_effects(capped)["B"] == -2.0
