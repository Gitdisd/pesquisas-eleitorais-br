use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

pub const N_REF: f64 = 2000.0;
pub const MIN_SAMPLE: f64 = 100.0;
pub const MAX_SAMPLE: f64 = 4000.0;

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
