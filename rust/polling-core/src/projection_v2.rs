use crate::{
    estimate_house_effects, project_trend, weighted_trend_v2, PollObservation, ProjectPoint,
    ProjectionResult, SeriesPoint, DAY_MS,
};
use std::collections::BTreeMap;

const CAMPAIGN_MS: f64 = 1_786_881_600_000.0;
const DEFAULT_FIT_DAYS: f64 = 14.0;
const DEFAULT_HORIZON_DAYS: u32 = 14;
const HOLDOUT_HORIZON_DAYS: u32 = 8;
const HOLDOUT_DAYS: f64 = 7.0;
const HOLDOUT_BAND_FLOOR: f64 = 2.4;
const MODEL_MAX_ABS_SLOPE: f64 = 0.2;

#[derive(Debug, Clone, PartialEq)]
pub struct HoldoutGateResult {
    pub pass: bool,
    pub reason: Option<String>,
    pub rmse_model: Option<f64>,
    pub rmse_persist: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProjectionV2Result {
    pub ok: bool,
    pub reason: Option<String>,
    pub line: Vec<ProjectPoint>,
    pub band_low: Vec<ProjectPoint>,
    pub band_high: Vec<ProjectPoint>,
    pub last_observed: Option<f64>,
    pub slope: Option<f64>,
    pub rmse: Option<f64>,
    pub horizon_used: u32,
    pub holdout: Option<HoldoutGateResult>,
    pub house: BTreeMap<String, f64>,
    pub model: u8,
}

fn empty(reason: &str) -> ProjectionV2Result {
    ProjectionV2Result {
        ok: false,
        reason: Some(reason.to_string()),
        line: Vec::new(),
        band_low: Vec::new(),
        band_high: Vec::new(),
        last_observed: None,
        slope: None,
        rmse: None,
        horizon_used: 0,
        holdout: None,
        house: BTreeMap::new(),
        model: 2,
    }
}

fn nearest(line: &[ProjectPoint], x: f64) -> Option<ProjectPoint> {
    let mut iter = line.iter().copied();
    let first = iter.next()?;
    let mut best = first;
    let mut best_distance = (first.x - x).abs();
    for point in iter {
        let distance = (point.x - x).abs();
        if distance < best_distance {
            best = point;
            best_distance = distance;
        }
    }
    Some(best)
}

/// Match production projection-v2 process-noise selection exactly.
pub fn process_sd_for(t_last: f64, election_day_ms: Option<f64>) -> f64 {
    let mut sd = 0.12;
    if t_last >= CAMPAIGN_MS {
        sd = 0.18;
    }
    if let Some(election) = election_day_ms.filter(|value| value.is_finite()) {
        if (election - t_last) / DAY_MS <= 14.0 {
            sd = 0.26;
        }
    }
    sd
}

/// Reproduce the production seven-day rolling holdout gate against persistence.
pub fn holdout_gate(
    series: &[SeriesPoint],
    fit_days: f64,
    process_sd: f64,
    band_floor: f64,
) -> HoldoutGateResult {
    let fail = |reason: &str| HoldoutGateResult {
        pass: false,
        reason: Some(reason.to_string()),
        rmse_model: None,
        rmse_persist: None,
    };

    if series.len() < 8 {
        return fail("short_series");
    }

    let mut sorted = series.to_vec();
    sorted.sort_by(|a, b| a.x.total_cmp(&b.x));
    let t_last = sorted.last().unwrap().x;
    let cut = t_last - HOLDOUT_DAYS * DAY_MS;
    let train: Vec<SeriesPoint> = sorted.iter().copied().filter(|p| p.x <= cut).collect();
    let test: Vec<SeriesPoint> = sorted.iter().copied().filter(|p| p.x > cut).collect();

    if train.len() < 4 || test.len() < 2 {
        return fail("thin_holdout");
    }

    let persist = train.last().unwrap().y;
    let projection = project_trend(
        &train,
        fit_days,
        HOLDOUT_HORIZON_DAYS,
        None,
        4,
        0.25,
        10.0,
        1.645,
        band_floor,
        process_sd,
    );
    if !projection.ok || projection.line.is_empty() {
        return fail("proj_failed");
    }

    let mut se_model = 0.0;
    let mut se_persist = 0.0;
    for target in &test {
        let predicted = nearest(&projection.line, target.x)
            .map(|point| point.y)
            .unwrap_or(persist);
        let model_error = predicted - target.y;
        let persist_error = persist - target.y;
        se_model += model_error * model_error;
        se_persist += persist_error * persist_error;
    }

    let rmse_model = (se_model / test.len() as f64).sqrt();
    let rmse_persist = (se_persist / test.len() as f64).sqrt();
    HoldoutGateResult {
        pass: rmse_model + 1e-6 < rmse_persist,
        reason: if rmse_model < rmse_persist {
            None
        } else {
            Some("holdout_fail".into())
        },
        rmse_model: Some(rmse_model),
        rmse_persist: Some(rmse_persist),
    }
}

/// Reproduce the production model-2 projection-v2 sequence.
///
/// The post-house-effect observations deliberately omit institute identity, matching
/// the current JavaScript implementation: weightedTrendV2 therefore does not apply
/// another institute/day flood divisor after house correction.
pub fn project_trend_v2(
    raw_points: &[PollObservation],
    fit_days: f64,
    horizon_days: u32,
    election_day_ms: Option<f64>,
) -> ProjectionV2Result {
    if raw_points.is_empty() {
        return empty("empty_series");
    }

    let fit_days = if fit_days.is_finite() {
        fit_days
    } else {
        DEFAULT_FIT_DAYS
    };
    let horizon_days = if horizon_days == 0 {
        DEFAULT_HORIZON_DAYS
    } else {
        horizon_days
    };

    let house = estimate_house_effects(raw_points, 14.0);
    let debiased: Vec<PollObservation> = raw_points
        .iter()
        .map(|point| {
            let adjustment = point
                .institute
                .as_deref()
                .and_then(|key| house.get(key))
                .copied()
                .unwrap_or(0.0);
            PollObservation {
                t: point.t,
                y: point.y - adjustment,
                n: point.n,
                institute: None,
                moe: None,
            }
        })
        .collect();

    let trend = weighted_trend_v2(&debiased, fit_days);
    if trend.len() < 4 {
        let mut result = empty("insufficient_points");
        result.house = house;
        return result;
    }

    let t_last = trend.last().unwrap().x;
    let sd = process_sd_for(t_last, election_day_ms);
    let gate = holdout_gate(&trend, fit_days, sd, HOLDOUT_BAND_FLOOR);

    if !gate.pass {
        let reason = gate.reason.as_deref().unwrap_or("holdout_fail");
        let mut result = empty(reason);
        result.last_observed = Some(t_last);
        result.holdout = Some(gate);
        result.house = house;
        return result;
    }

    let projection = project_trend(
        &trend,
        fit_days,
        horizon_days,
        election_day_ms,
        4,
        MODEL_MAX_ABS_SLOPE,
        10.0,
        1.645,
        HOLDOUT_BAND_FLOOR,
        sd,
    );

    let ProjectionResult {
        ok,
        reason,
        line,
        band_low,
        band_high,
        last_observed,
        slope,
        rmse,
        horizon_used,
    } = projection;

    ProjectionV2Result {
        ok,
        reason,
        line,
        band_low,
        band_high,
        last_observed,
        slope,
        rmse,
        horizon_used,
        holdout: Some(gate),
        house,
        model: 2,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn process_sd_steps_through_production_thresholds() {
        assert!((process_sd_for(CAMPAIGN_MS - 1.0, None) - 0.12).abs() < 1e-12);
        assert!((process_sd_for(CAMPAIGN_MS, None) - 0.18).abs() < 1e-12);

        let election = 1_800_000_000_000.0;
        let within_fourteen = election - 14.0 * DAY_MS;
        assert!((process_sd_for(within_fourteen, Some(election)) - 0.26).abs() < 1e-12);
    }

    #[test]
    fn holdout_gate_accepts_a_clear_linear_improvement_over_persistence() {
        let series: Vec<SeriesPoint> = (0..12)
            .map(|day| SeriesPoint {
                x: day as f64 * DAY_MS,
                y: 40.0 + 0.5 * day as f64,
            })
            .collect();
        let gate = holdout_gate(&series, 14.0, 0.12, 2.4);
        assert!(gate.pass);
        assert!(gate.rmse_model.unwrap() < gate.rmse_persist.unwrap());
    }

    #[test]
    fn projection_v2_preserves_model_identity_and_house_shape() {
        let rows: Vec<PollObservation> = (0..12)
            .map(|day| PollObservation {
                t: day as f64 * DAY_MS,
                y: 40.0 + 0.5 * day as f64,
                n: Some(2000.0),
                institute: Some("A".into()),
                moe: None,
            })
            .collect();
        let result = project_trend_v2(&rows, 14.0, 14, None);
        assert!(result.ok);
        assert_eq!(result.model, 2);
        assert_eq!(result.house.get("A").copied(), None);
        assert_eq!(result.horizon_used, 14);
    }
}
