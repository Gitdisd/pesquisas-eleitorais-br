use polling_core::{poll_weight, PollObservation};
use crate::data::Poll;

pub const WIDTH: f64 = 1100.0;
pub const HEIGHT: f64 = 470.0;
pub const LEFT: f64 = 58.0;
pub const RIGHT: f64 = 22.0;
pub const TOP: f64 = 18.0;
pub const BOTTOM: f64 = 52.0;
const DAY_MS: f64 = 86_400_000.0;

#[derive(Clone, Debug)]
pub struct TrendPoint {
    pub day: i64,
    pub value: f64,
}

pub fn weighted_trend(rows: &[Poll], half_life_days: f64) -> Vec<TrendPoint> {
    if rows.is_empty() { return Vec::new(); }
    let min_day = rows.first().map(|p| p.day).unwrap_or(0);
    let max_day = rows.last().map(|p| p.day).unwrap_or(min_day);
    let half = half_life_days.max(1.0);
    let reach = (half * 2.5).ceil() as i64;
    let mut out = Vec::new();

    for day in min_day..=max_day {
        let mut numerator = 0.0;
        let mut denominator = 0.0;
        let mut nearest = i64::MAX;
        for row in rows {
            let distance = (day - row.day).abs();
            nearest = nearest.min(distance);
            if distance > reach { continue; }
            let point = PollObservation {
                t: row.day as f64 * DAY_MS,
                y: row.value,
                n: Some(row.n),
                institute: Some(row.institute.clone()),
                moe: None,
            };
            let target = day as f64 * DAY_MS;
            let weight = poll_weight(&point, target, half, 1.0).total;
            numerator += weight * row.value;
            denominator += weight;
        }
        if denominator > 0.0 && nearest as f64 <= half {
            out.push(TrendPoint {
                day,
                value: (numerator / denominator * 100.0).round() / 100.0,
            });
        }
    }
    out
}

pub fn viewbox(rows: &[Poll], trend: &[TrendPoint]) -> (f64, f64, f64, f64) {
    if rows.is_empty() { return (0.0, 1.0, 0.0, 100.0); }
    let min_day = rows.first().unwrap().day as f64;
    let max_day = rows.last().unwrap().day as f64;
    let mut min_y = rows.iter().map(|p| p.value).fold(f64::INFINITY, f64::min);
    let mut max_y = rows.iter().map(|p| p.value).fold(f64::NEG_INFINITY, f64::max);
    for point in trend {
        min_y = min_y.min(point.value);
        max_y = max_y.max(point.value);
    }
    let span = (max_y - min_y).max(5.0);
    let pad = (span * 0.12).max(2.0);
    let low = (min_y - pad).max(0.0);
    let high = (max_y + pad).min(100.0).max(low + 5.0);
    (min_day, max_day.max(min_day + 1.0), low, high)
}

pub fn x_for(day: i64, min_day: f64, max_day: f64) -> f64 {
    let width = WIDTH - LEFT - RIGHT;
    LEFT + ((day as f64 - min_day) / (max_day - min_day).max(1.0)) * width
}

pub fn y_for(value: f64, low: f64, high: f64) -> f64 {
    let height = HEIGHT - TOP - BOTTOM;
    TOP + (1.0 - (value - low) / (high - low).max(1.0)) * height
}

pub fn polyline_path(points: &[TrendPoint], min_day: f64, max_day: f64, low: f64, high: f64) -> String {
    points.iter()
        .map(|point| format!("{:.2},{:.2}", x_for(point.day, min_day, max_day), y_for(point.value, low, high)))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn poll(day: i64, value: f64, n: f64, institute: &str) -> Poll {
        Poll {
            id: format!("{day}:{institute}:{value}"),
            institute: institute.into(),
            fieldwork_end: "2026-09-21".into(),
            published_date: None,
            scenario: "1º turno".into(),
            n,
            geo: "BR".into(),
            source_url: String::new(),
            candidate_key: "lula".into(),
            value,
            round: 1,
            day,
        }
    }

    #[test]
    fn trend_uses_the_shared_poll_weight_primitive() {
        let rows = vec![
            poll(0, 41.76, 40_500.0, "Veritá"),
            poll(-2, 39.0, 2002.0, "Datafolha"),
            poll(-3, 44.1, 5018.0, "AtlasIntel"),
            poll(-3, 37.0, 2400.0, "Gerp"),
            poll(-3, 37.0, 3000.0, "PoderData"),
            poll(-4, 38.3, 2000.0, "Futura/Apex"),
            poll(-5, 39.0, 2000.0, "DataTrends"),
            poll(-6, 40.5, 2002.0, "CNT/MDA"),
        ];
        let trend = weighted_trend(&rows, 14.0);
        let last = trend.last().expect("trend point");
        assert_eq!(last.day, 0);
        assert!((last.value - 39.84).abs() < 0.005);
    }
}
