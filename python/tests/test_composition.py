from pebr_stats.composition import (
    DEFAULT_COMPONENTS,
    CompositionPoll,
    forecast_composition,
)


def make_poll(t, values):
    data = dict(values)
    data["__residual__"] = 100 - sum(data.values())
    return CompositionPoll(t=t, y=data, n=2000, institute="Example")


def test_composition_forecast_is_simplex_safe():
    rows = []
    for t, shift in [(0, 0), (86_400_000, 1), (2 * 86_400_000, 2), (3 * 86_400_000, 3)]:
        rows.append(
            make_poll(
                t,
                {
                    DEFAULT_COMPONENTS[0]: 35 + shift,
                    DEFAULT_COMPONENTS[1]: 30 - shift,
                    DEFAULT_COMPONENTS[2]: 8,
                    DEFAULT_COMPONENTS[3]: 5,
                    DEFAULT_COMPONENTS[4]: 4,
                    DEFAULT_COMPONENTS[5]: 3,
                },
            )
        )

    forecast = forecast_composition(rows, 3 * 86_400_000, 3)
    assert forecast is not None
    assert abs(sum(forecast.values.values()) + forecast.residual - 100.0) < 1e-9
    assert all(value >= 0 for value in forecast.values.values())
    assert forecast.residual >= 0
