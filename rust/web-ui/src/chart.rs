use crate::data::Poll;
use polling_core::{
    average_trend_advanced, estimate_house_effects, project_trend_v2, weighted_trend_v1,
    weighted_trend_v2 as core_weighted_trend_v2, ELECTION_ROUND1_MS, ELECTION_ROUND2_MS,
    PollObservation, ProjectionV2Result,
};
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

pub const MODEL_OPTIONS: &[(u8, &str)] = &[
    (1, "Exp"),
    (2, "Casa"),
    (3, "Meta"),
    (4, "Kalman"),
    (5, "Rápido"),
    (6, "Dia"),
    (7, "Local"),
    (8, "Média"),
    (9, "Peso"),
    (10, "Mediana"),
    (11, "Moda"),
    (12, "Corta"),
];

pub fn model_label(model: u8) -> &'static str {
    MODEL_OPTIONS
        .iter()
        .find(|(value, _)| *value == model)
        .map(|(_, label)| *label)
        .unwrap_or("Exp")
}

fn observations(rows: &[Poll]) -> Vec<PollObservation> {
    rows.iter()
        .map(|row| PollObservation {
            t: row.day as f64 * DAY_MS,
            y: row.value,
            n: Some(row.n),
            institute: Some(row.institute.clone()),
            moe: row.moe,
        })
        .collect()
}

pub fn weighted_trend(rows: &[Poll], half_life_days: f64) -> Vec<TrendPoint> {
    weighted_trend_v1(&observations(rows), half_life_days)
        .into_iter()
        .map(|point| TrendPoint {
            day: (point.x / DAY_MS).round() as i64,
            value: point.y,
        })
        .collect()
}

pub fn weighted_trend_model_2(rows: &[Poll], half_life_days: f64) -> Vec<TrendPoint> {
    let observations = observations(rows);
    let house = estimate_house_effects(&observations, 14.0);
    let debiased: Vec<PollObservation> = observations
        .iter()
        .map(|point| {
            let adjustment = point
                .institute
                .as_deref()
                .and_then(|key| house.get(key))
                .copied()
                .unwrap_or(0.0);
            PollObservation {
                y: point.y - adjustment,
                ..point.clone()
            }
        })
        .collect();
    core_weighted_trend_v2(&debiased, half_life_days)
        .into_iter()
        .map(|point| TrendPoint {
            day: (point.x / DAY_MS).round() as i64,
            value: point.y,
        })
        .collect()
}

pub fn trend_for_model(rows: &[Poll], half_life_days: f64, model: u8) -> Vec<TrendPoint> {
    match model {
        1 => weighted_trend(rows, half_life_days),
        2 => weighted_trend_model_2(rows, half_life_days),
        3..=12 => average_trend_advanced(&observations(rows), half_life_days, model)
            .into_iter()
            .map(|point| TrendPoint {
                day: (point.x / DAY_MS).round() as i64,
                value: point.y,
            })
            .collect(),
        _ => weighted_trend(rows, half_life_days),
    }
}

pub fn projection_v2_for_round(rows: &[Poll], round: u8) -> ProjectionV2Result {
    let election_day_ms = if round == 2 {
        Some(ELECTION_ROUND2_MS)
    } else {
        Some(ELECTION_ROUND1_MS)
    };
    project_trend_v2(&observations(rows), 14.0, 14, election_day_ms)
}

pub fn viewbox(rows: &[Poll], trend: &[TrendPoint], projection: Option<&ProjectionV2Result>) -> (f64, f64, f64, f64) {
    if rows.is_empty() { return (0.0, 1.0, 0.0, 100.0); }
    let min_day = rows.first().unwrap().day as f64;
    let mut max_day = rows.last().unwrap().day as f64;
    let mut min_y = rows.iter().map(|p| p.value).fold(f64::INFINITY, f64::min);
    let mut max_y = rows.iter().map(|p| p.value).fold(f64::NEG_INFINITY, f64::max);
    for point in trend {
        min_y = min_y.min(point.value);
        max_y = max_y.max(point.value);
    }
    if let Some(proj) = projection.filter(|value| value.ok) {
        if let Some(last) = proj.line.last() {
            max_day = max_day.max(last.x / DAY_MS);
        }
        for point in proj.band_low.iter().chain(proj.band_high.iter()) {
            min_y = min_y.min(point.y);
            max_y = max_y.max(point.y);
        }
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
            fieldwork_start: None,
            fieldwork_end: "2026-09-21".into(),
            published_date: None,
            scenario: "1º turno".into(),
            n,
            geo: "BR".into(),
            source_url: String::new(),
            tse_registration: None,
            verified: true,
            moe: None,
            candidate_key: "lula".into(),
            value,
            round: 1,
            day,
        }
    }

    #[test]
    fn projection_v2_uses_the_rust_core_and_honors_election_horizon() {
        let rows: Vec<Poll> = (0..12)
            .map(|day| poll(day, 40.0 + 0.8 * day as f64, 2000.0, "ParityLab"))
            .collect();
        let result = projection_v2_for_round(&rows, 1);
        assert_eq!(result.model, 2);
        assert!(result.ok);
        assert_eq!(result.horizon_used, 14);
        assert!(result.line.len() > 1);
        assert_eq!(result.last_observed, result.line.first().map(|point| point.x));
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
