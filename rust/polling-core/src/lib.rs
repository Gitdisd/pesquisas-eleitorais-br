use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

pub const N_REF: f64 = 2000.0;
pub const MIN_SAMPLE: f64 = 100.0;
pub const MAX_SAMPLE: f64 = 4000.0;
pub const DAY_MS: f64 = 86_400_000.0;

mod aggregation;
mod house_effects;
mod projection;
mod candidates;
mod identity;

pub use aggregation::{weighted_trend_v1, SeriesPoint};
pub use house_effects::estimate_house_effects;
pub use projection::{project_trend, ProjectPoint, ProjectionResult};
pub use candidates::{candidate_key, is_first_round, is_second_round, Candidate};
pub use identity::{
    canonical_poll_key, coverage_dates, fallback_poll_key, identity_match_keys,
    normalize_geo, normalize_identity_text, normalize_institute, normalize_protocol,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PollObservation {
    pub t: f64,
    pub y: f64,
    pub n: Option<f64>,
    pub institute: Option<String>,
    pub moe: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PollWeight {
    pub total: f64,
    pub sample: f64,
    pub recency: f64,
    pub flood: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EstimatorResult {
    pub date: f64,
    pub candidate: String,
    pub estimate: Option<f64>,
    pub lower: Option<f64>,
    pub upper: Option<f64>,
    pub effective_sample_size: f64,
}

pub fn sample_size(n: Option<f64>) -> f64 {
    match n {
        Some(v) if v.is_finite() && v > 0.0 => v.clamp(MIN_SAMPLE, MAX_SAMPLE),
        _ => 800.0,
    }
}

pub fn poll_weight(point: &PollObservation, t: f64, half_life_days: f64, flood_count: f64) -> PollWeight {
    let days = ((t - point.t).abs() / 86_400_000.0).max(0.0);
    let half = half_life_days.max(1.0);
    let sample = (sample_size(point.n) / N_REF).sqrt();
    let recency = 2.0_f64.powf(-days / half);
    let flood = flood_count.max(1.0);
    PollWeight { total: sample * recency / flood, sample, recency, flood }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct UncertaintyPoint {
    pub x: f64,
    pub low: f64,
    pub high: f64,
    pub se: f64,
}

/// Estimated 90% aggregate uncertainty band matching the production formula.
/// This is not a survey margin of error and does not assert calibrated coverage.
pub fn uncertainty_band(points: &[PollObservation], window_days: f64, z: f64) -> Vec<UncertaintyPoint> {
    if points.is_empty() {
        return Vec::new();
    }
    let mut sorted: Vec<&PollObservation> = points
        .iter()
        .filter(|p| p.t.is_finite() && p.y.is_finite())
        .collect();
    sorted.sort_by(|a, b| a.t.total_cmp(&b.t));
    if sorted.is_empty() {
        return Vec::new();
    }

    let requested = if window_days.is_finite() && window_days != 0.0 { window_days } else { 14.0 };
    let half = requested.max(1.0);
    let reach = half * 2.5;
    let min_band = 0.75_f64;
    let t_min = sorted[0].t;
    let t_max = sorted[sorted.len() - 1].t;
    let mut out = Vec::new();
    let mut t = t_min;

    while t <= t_max {
        let mut bag: Vec<(f64, f64, Option<f64>)> = Vec::new();
        let mut nearest = f64::INFINITY;
        for point in &sorted {
            let days = (t - point.t).abs() / DAY_MS;
            if days < nearest { nearest = days; }
            if days > reach { continue; }
            let weight = poll_weight(point, t, half, 1.0).total;
            let se = match point.moe {
                Some(moe) if moe.is_finite() && moe > 0.0 => Some((moe / 1.96).max(0.4)),
                _ => None,
            };
            bag.push((point.y, weight, se));
        }
        if nearest > half || bag.is_empty() {
            t += DAY_MS;
            continue;
        }
        let den: f64 = bag.iter().map(|(_, w, _)| *w).sum();
        if !(den > 0.0) {
            t += DAY_MS;
            continue;
        }
        let mu = bag.iter().map(|(y, w, _)| w * y).sum::<f64>() / den;
        let sum_w2 = bag.iter().map(|(_, w, _)| w * w).sum::<f64>();
        let n_eff = (den * den) / sum_w2.max(1e-9);
        let between_var = bag.iter().map(|(y, w, _)| w * (y - mu).powi(2)).sum::<f64>() / den;
        let measurement_var = bag.iter()
            .map(|(_, w, se)| w * w * se.unwrap_or(0.0).powi(2))
            .sum::<f64>() / (den * den).max(1e-9);
        let se_value = min_band.max((between_var / n_eff + measurement_var).max(0.0).sqrt());
        let band = min_band.max(z * se_value);
        let center = (mu * 100.0).round() / 100.0;
        let low = (center - band).max(0.0).min(100.0);
        let high = (center + band).max(0.0).min(100.0);
        out.push(UncertaintyPoint {
            x: t,
            low: (low * 100.0).round() / 100.0,
            high: (high * 100.0).round() / 100.0,
            se: (se_value * 1000.0).round() / 1000.0,
        });
        t += DAY_MS;
    }
    out
}

#[wasm_bindgen]
pub fn weighted_estimate(observations: JsValue, date: f64, candidate: String, half_life_days: f64) -> Result<JsValue, JsValue> {
    let rows: Vec<PollObservation> = serde_wasm_bindgen::from_value(observations)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let mut num = 0.0;
    let mut den = 0.0;
    let mut sum_w2 = 0.0;
    for row in &rows {
        if !row.y.is_finite() { continue; }
        let w = poll_weight(row, date, half_life_days, 1.0).total;
        num += w * row.y;
        den += w;
        sum_w2 += w * w;
    }
    let result = EstimatorResult {
        date,
        candidate,
        estimate: if den > 0.0 { Some(num / den) } else { None },
        lower: None,
        upper: None,
        effective_sample_size: if sum_w2 > 0.0 { den * den / sum_w2 } else { 0.0 },
    };
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn weighted_mean(observations: JsValue, t: f64, half_life_days: f64) -> Result<f64, JsValue> {
    let rows: Vec<PollObservation> = serde_wasm_bindgen::from_value(observations)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let mut num = 0.0;
    let mut den = 0.0;
    for row in rows {
        if !row.y.is_finite() { continue; }
        let w = poll_weight(&row, t, half_life_days, 1.0).total;
        num += w * row.y;
        den += w;
    }
    Ok(if den > 0.0 { num / den } else { f64::NAN })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn canonical_sample_cap() {
        assert_eq!(sample_size(Some(9000.0)), 4000.0);
        assert_eq!(sample_size(Some(50.0)), 100.0);
        assert_eq!(sample_size(None), 800.0);
    }
    #[test]
    fn rust_real_fixture_matches_python_reference() {
        let rows = vec![
            PollObservation { t: 0.0, y: 41.76, n: Some(40500.0), institute: Some("Veritá".into()), moe: None },
            PollObservation { t: -86_400_000.0 * 2.0, y: 39.0, n: Some(2002.0), institute: Some("Datafolha".into()), moe: None },
            PollObservation { t: -86_400_000.0 * 3.0, y: 44.1, n: Some(5018.0), institute: Some("AtlasIntel".into()), moe: None },
            PollObservation { t: -86_400_000.0 * 3.0, y: 37.0, n: Some(2400.0), institute: Some("Gerp".into()), moe: None },
            PollObservation { t: -86_400_000.0 * 3.0, y: 37.0, n: Some(3000.0), institute: Some("PoderData".into()), moe: None },
            PollObservation { t: -86_400_000.0 * 4.0, y: 38.3, n: Some(2000.0), institute: Some("Futura/Apex".into()), moe: None },
            PollObservation { t: -86_400_000.0 * 5.0, y: 39.0, n: Some(2000.0), institute: Some("DataTrends".into()), moe: None },
            PollObservation { t: -86_400_000.0 * 6.0, y: 40.5, n: Some(2002.0), institute: Some("CNT/MDA".into()), moe: None },
        ];
        let mut num = 0.0;
        let mut den = 0.0;
        let mut sum_w2 = 0.0;
        for row in &rows {
            let w = poll_weight(row, 0.0, 14.0, 1.0).total;
            num += w * row.y;
            den += w;
            sum_w2 += w * w;
        }
        assert!((num / den - 39.844918909571696).abs() < 1e-12);
        assert!((den * den / sum_w2 - 7.627807236011811).abs() < 1e-12);
    }

    #[test]
    fn rust_weighted_mean_fixture() {
        let rows = vec![
            PollObservation { t: 0.0, y: 40.0, n: Some(2000.0), institute: None, moe: None },
            PollObservation { t: 86_400_000.0 * 7.0, y: 50.0, n: Some(4000.0), institute: None, moe: None },
            PollObservation { t: 86_400_000.0 * 14.0, y: 45.0, n: Some(1000.0), institute: None, moe: None },
        ];
        let t = 86_400_000.0 * 7.0;
        let mut num = 0.0;
        let mut den = 0.0;
        for row in rows { let w = poll_weight(&row, t, 14.0, 1.0).total; num += w * row.y; den += w; }
        let value = num / den;
        assert!((value - 46.348761).abs() < 1e-6);
    }
}
