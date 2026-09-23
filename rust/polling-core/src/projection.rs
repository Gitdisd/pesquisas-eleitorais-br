use crate::{DAY_MS, SeriesPoint};

pub const ELECTION_ROUND1_MS: f64 = 1_791_100_800_000.0;
pub const ELECTION_ROUND2_MS: f64 = 1_792_912_800_000.0;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ProjectPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProjectionResult {
    pub ok: bool,
    pub reason: Option<String>,
    pub line: Vec<ProjectPoint>,
    pub band_low: Vec<ProjectPoint>,
    pub band_high: Vec<ProjectPoint>,
    pub last_observed: Option<f64>,
    pub slope: Option<f64>,
    pub rmse: Option<f64>,
    pub horizon_used: u32,
}

fn empty(reason: &str) -> ProjectionResult {
    ProjectionResult {
        ok: false,
        reason: Some(reason.to_string()),
        line: Vec::new(),
        band_low: Vec::new(),
        band_high: Vec::new(),
        last_observed: None,
        slope: None,
        rmse: None,
        horizon_used: 0,
    }
}

fn clamp(value: f64, low: f64, high: f64) -> f64 {
    value.max(low).min(high)
}

fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

pub fn project_trend(series: &[SeriesPoint], fit_days: f64, horizon_days: u32, election_day_ms: Option<f64>, min_points: usize, max_abs_slope: f64, damp_tau_days: f64, z: f64, band_floor: f64, process_sd: f64) -> ProjectionResult {
    if series.is_empty() { return empty("empty_series"); }

    let fit_days = if fit_days.is_finite() { fit_days.round().clamp(7.0, 28.0) } else { 14.0 };
    let horizon_cap = horizon_days.max(1);
    let min_points = min_points.max(2);
    let max_abs_slope = if max_abs_slope.is_finite() { max_abs_slope } else { 0.25 };
    let damp_tau_days = if damp_tau_days.is_finite() { damp_tau_days.max(1.0) } else { 10.0 };
    let z = if z.is_finite() { z } else { 1.645 };
    let band_floor = if band_floor.is_finite() { band_floor } else { 2.0 };
    let process_sd = if process_sd.is_finite() { process_sd } else { 0.12 };

    let mut sorted = series.to_vec();
    sorted.sort_by(|a, b| a.x.total_cmp(&b.x));
    let t_last = sorted.last().unwrap().x;
    let y_last = sorted.last().unwrap().y;
    let t_cut = t_last - fit_days * DAY_MS;
    let window: Vec<SeriesPoint> = sorted.into_iter().filter(|p| p.x >= t_cut).collect();
    if window.len() < min_points {
        let mut result = empty("insufficient_points");
        result.last_observed = Some(t_last);
        return result;
    }

    let mut days_to_election = f64::INFINITY;
    if let Some(election) = election_day_ms.filter(|v| v.is_finite()) {
        days_to_election = ((election - t_last) / DAY_MS).floor();
        if days_to_election < 1.0 {
            let mut result = empty("past_or_on_election");
            result.last_observed = Some(t_last);
            return result;
        }
    }
    let horizon = (horizon_cap as f64).min(days_to_election) as u32;
    if horizon < 1 {
        let mut result = empty("horizon_zero");
        result.last_observed = Some(t_last);
        return result;
    }

    let t0 = window[0].x;
    let mut sum_t = 0.0;
    let mut sum_y = 0.0;
    let mut sum_tt = 0.0;
    let mut sum_ty = 0.0;
    let n = window.len() as f64;
    for p in &window {
        let t = (p.x - t0) / DAY_MS;
        sum_t += t;
        sum_y += p.y;
        sum_tt += t * t;
        sum_ty += t * p.y;
    }
    let denominator = n * sum_tt - sum_t * sum_t;
    let mut slope = if denominator == 0.0 { 0.0 } else { (n * sum_ty - sum_t * sum_y) / denominator };
    let intercept = (sum_y - slope * sum_t) / n;
    slope = clamp(slope, -max_abs_slope, max_abs_slope);

    let mut sse = 0.0;
    for p in &window {
        let t = (p.x - t0) / DAY_MS;
        let e = p.y - (intercept + slope * t);
        sse += e * e;
    }
    let rmse = (sse / (window.len().saturating_sub(2).max(1) as f64)).sqrt();

    let mut line = vec![ProjectPoint { x: t_last, y: round1(y_last) }];
    let mut band_low = vec![ProjectPoint { x: t_last, y: round1(y_last) }];
    let mut band_high = vec![ProjectPoint { x: t_last, y: round1(y_last) }];

    for day in 1..=horizon {
        let x = t_last + day as f64 * DAY_MS;
        let d = day as f64;
        let delta = slope * damp_tau_days * (1.0 - (-d / damp_tau_days).exp());
        let y = clamp(y_last + delta, 0.0, 100.0);
        let widen = z * (rmse * rmse * (1.0 + d / fit_days) + band_floor * band_floor + process_sd * process_sd * d).sqrt();
        line.push(ProjectPoint { x, y: round1(y) });
        band_low.push(ProjectPoint { x, y: round1(clamp(y - widen, 0.0, 100.0)) });
        band_high.push(ProjectPoint { x, y: round1(clamp(y + widen, 0.0, 100.0)) });
    }

    ProjectionResult {
        ok: true,
        reason: None,
        line,
        band_low,
        band_high,
        last_observed: Some(t_last),
        slope: Some(slope),
        rmse: Some(rmse),
        horizon_used: horizon,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_series() {
        assert_eq!(project_trend(&[], 14.0, 14, None, 4, 0.25, 10.0, 1.645, 2.0, 0.12).reason.as_deref(), Some("empty_series"));
    }

    #[test]
    fn caps_slope_and_preserves_current_point() {
        let rows: Vec<SeriesPoint> = (0..6).map(|day| SeriesPoint { x: day as f64 * DAY_MS, y: 40.0 + day as f64 }).collect();
        let result = project_trend(&rows, 14.0, 4, None, 4, 0.25, 10.0, 1.645, 2.0, 0.12);
        assert!(result.ok);
        assert!((result.slope.unwrap() - 0.25).abs() < 1e-12);
        assert_eq!(result.line[0].x, 5.0 * DAY_MS);
        assert_eq!(result.line[0].y, 45.0);
        assert_eq!(result.horizon_used, 4);
    }
}
