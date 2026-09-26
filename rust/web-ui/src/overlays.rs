#![cfg_attr(target_arch = "wasm32", allow(dead_code))]

use crate::chart::TrendPoint;
use crate::data::Poll;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum OverlayKind {
    Line,
    Band,
}

#[derive(Clone, Copy)]
pub struct OverlayDef {
    pub id: &'static str,
    pub label: &'static str,
    pub kind: OverlayKind,
}

pub const OVERLAYS: &[OverlayDef] = &[
    OverlayDef { id: "sma7", label: "SMA 7", kind: OverlayKind::Line },
    OverlayDef { id: "sma21", label: "SMA 21", kind: OverlayKind::Line },
    OverlayDef { id: "ema9", label: "EMA 9", kind: OverlayKind::Line },
    OverlayDef { id: "ema21", label: "EMA 21", kind: OverlayKind::Line },
    OverlayDef { id: "hma", label: "HMA 16", kind: OverlayKind::Line },
    OverlayDef { id: "vwma", label: "VWMA 14", kind: OverlayKind::Line },
    OverlayDef { id: "kama", label: "KAMA 10", kind: OverlayKind::Line },
    OverlayDef { id: "bb", label: "Bollinger 20", kind: OverlayKind::Band },
];

#[derive(Clone, Default)]
pub struct OverlayResult {
    pub mid: Vec<TrendPoint>,
    pub high: Vec<TrendPoint>,
    pub low: Vec<TrendPoint>,
}

fn sma_at(values: &[f64], i: usize, len: usize) -> Option<f64> {
    if i + 1 < len {
        return None;
    }
    let sum = values[i + 1 - len..=i].iter().sum::<f64>();
    Some(sum / len as f64)
}

fn ema(values: &[f64], len: usize) -> Vec<Option<f64>> {
    if values.is_empty() {
        return Vec::new();
    }
    let alpha = 2.0 / (len as f64 + 1.0);
    let mut out = vec![None; values.len()];
    let mut e = values[0];
    out[0] = Some(e);
    for i in 1..values.len() {
        e = alpha * values[i] + (1.0 - alpha) * e;
        out[i] = Some(e);
    }
    out
}

fn wma_at(values: &[f64], i: usize, len: usize) -> Option<f64> {
    if i + 1 < len {
        return None;
    }
    let mut num = 0.0;
    let mut den = 0.0;
    for k in 0..len {
        let w = (k + 1) as f64;
        num += values[i + 1 - len + k] * w;
        den += w;
    }
    (den > 0.0).then_some(num / den)
}

fn hma(values: &[f64], len: usize) -> Vec<Option<f64>> {
    let half = (len / 2).max(2);
    let sq = (len as f64).sqrt().round() as usize;
    let sq = sq.max(2);
    let mut raw = vec![None; values.len()];
    for i in 0..values.len() {
        let a = wma_at(values, i, half);
        let b = wma_at(values, i, len);
        if let (Some(a), Some(b)) = (a, b) {
            raw[i] = Some(2.0 * a - b);
        }
    }
    let mut out = vec![None; values.len()];
    for i in 0..values.len() {
        if i + 1 < sq {
            continue;
        }
        let start = i + 1 - sq;
        if raw[start..=i].iter().any(|v| v.is_none()) {
            continue;
        }
        let slice = raw[start..=i].iter().map(|v| v.unwrap()).collect::<Vec<_>>();
        out[i] = wma_at(&slice, slice.len() - 1, sq);
    }
    out
}

fn kama(values: &[f64], len: usize, fast: usize, slow: usize) -> Vec<Option<f64>> {
    let mut out = vec![None; values.len()];
    if values.len() < len + 1 {
        return out;
    }
    let mut current = values[len];
    out[len] = Some(current);
    let fast_sc = 2.0 / (fast as f64 + 1.0);
    let slow_sc = 2.0 / (slow as f64 + 1.0);
    for i in len + 1..values.len() {
        let change = (values[i] - values[i - len]).abs();
        let mut volatility = 0.0;
        for k in i - len + 1..=i {
            volatility += (values[k] - values[k - 1]).abs();
        }
        let er = if volatility > 1e-9 { change / volatility } else { 0.0 };
        let sc = (er * (fast_sc - slow_sc) + slow_sc).powi(2);
        current += sc * (values[i] - current);
        out[i] = Some(current);
    }
    out
}

fn pack(series: &[TrendPoint], values: &[Option<f64>]) -> Vec<TrendPoint> {
    series.iter()
        .zip(values.iter())
        .filter_map(|(point, value)| value.map(|y| TrendPoint { day: point.day, value: round2(y) }))
        .collect()
}

fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

pub fn compute_overlay(id: &str, series: &[TrendPoint], raw: &[Poll]) -> OverlayResult {
    if series.is_empty() {
        return OverlayResult::default();
    }
    let values = series.iter().map(|point| point.value).collect::<Vec<_>>();

    match id {
        "sma7" => {
            let computed = values.iter().enumerate().map(|(i, _)| sma_at(&values, i, 7)).collect::<Vec<_>>();
            OverlayResult { mid: pack(series, &computed), ..Default::default() }
        }
        "sma21" => {
            let computed = values.iter().enumerate().map(|(i, _)| sma_at(&values, i, 21)).collect::<Vec<_>>();
            OverlayResult { mid: pack(series, &computed), ..Default::default() }
        }
        "ema9" => OverlayResult { mid: pack(series, &ema(&values, 9)), ..Default::default() },
        "ema21" => OverlayResult { mid: pack(series, &ema(&values, 21)), ..Default::default() },
        "hma" => OverlayResult { mid: pack(series, &hma(&values, 16)), ..Default::default() },
        "kama" => OverlayResult { mid: pack(series, &kama(&values, 10, 2, 30)), ..Default::default() },
        "vwma" => {
            let mut points = raw.iter()
                .filter(|poll| poll.round > 0)
                .map(|poll| (poll.day, poll.value, poll.n.max(800.0)))
                .collect::<Vec<_>>();
            points.sort_by_key(|item| item.0);
            let mut mid = Vec::new();
            for i in 13..points.len() {
                let mut num = 0.0;
                let mut den = 0.0;
                for item in &points[i - 13..=i] {
                    num += item.1 * item.2;
                    den += item.2;
                }
                if den > 0.0 {
                    mid.push(TrendPoint { day: points[i].0, value: round2(num / den) });
                }
            }
            OverlayResult { mid, ..Default::default() }
        }
        "bb" => {
            let mut mid = Vec::new();
            let mut high = Vec::new();
            let mut low = Vec::new();
            for i in 19..values.len() {
                if let Some(mean) = sma_at(&values, i, 20) {
                    let ss = values[i + 1 - 20..=i]
                        .iter()
                        .map(|value| (value - mean).powi(2))
                        .sum::<f64>();
                    let sd = (ss / 20.0).sqrt();
                    mid.push(TrendPoint { day: series[i].day, value: round2(mean) });
                    high.push(TrendPoint { day: series[i].day, value: round2(mean + 2.0 * sd) });
                    low.push(TrendPoint { day: series[i].day, value: round2(mean - 2.0 * sd) });
                }
            }
            OverlayResult { mid, high, low }
        }
        _ => OverlayResult::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn series() -> Vec<TrendPoint> {
        (0..25).map(|day| TrendPoint { day, value: 30.0 + day as f64 }).collect()
    }

    #[test]
    fn moving_average_starts_after_required_history() {
        let result = compute_overlay("sma7", &series(), &[]);
        assert_eq!(result.mid.len(), 0);
    }

    #[test]
    fn bollinger_has_matching_band_points() {
        let result = compute_overlay("bb", &series(), &[]);
        assert_eq!(result.mid.len(), result.high.len());
        assert_eq!(result.mid.len(), result.low.len());
    }
}
