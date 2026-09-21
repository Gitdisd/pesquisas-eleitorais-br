use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Observation {
    pub t: f64,
    pub y: f64,
    pub n: f64,
}

fn sample_size(n: f64) -> f64 {
    if n.is_finite() && n > 0.0 { n.clamp(100.0, 4000.0) } else { 800.0 }
}

fn weight(observation: &Observation, t: f64, half_life_days: f64) -> f64 {
    let days = ((t - observation.t).abs() / 86_400_000.0).max(0.0);
    let half = half_life_days.max(1.0);
    (sample_size(observation.n) / 2000.0).sqrt() * 2.0_f64.powf(-days / half)
}

#[wasm_bindgen]
pub fn weighted_mean(observations: JsValue, t: f64, half_life_days: f64) -> Result<f64, JsValue> {
    let rows: Vec<Observation> = serde_wasm_bindgen::from_value(observations)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let mut num = 0.0;
    let mut den = 0.0;
    for row in rows {
        if !row.y.is_finite() { continue; }
        let w = weight(&row, t, half_life_days);
        num += w * row.y;
        den += w;
    }
    Ok(if den > 0.0 { num / den } else { f64::NAN })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sample_size_is_capped() {
        assert_eq!(sample_size(9000.0), 4000.0);
        assert_eq!(sample_size(50.0), 100.0);
    }
}
