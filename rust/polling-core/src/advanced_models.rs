use crate::{estimate_house_effects, sample_size, PollObservation, SeriesPoint, DAY_MS, N_REF};
use std::collections::BTreeMap;

const DEFF: f64 = 1.3;
const FLOOD_DAYS: f64 = 14.0;

fn normalized_half(value: f64, minimum: f64, default: f64) -> f64 {
    let candidate = if value.is_finite() && value != 0.0 { value } else { default };
    candidate.max(minimum)
}

fn round2_clamped(value: f64) -> f64 {
    let bounded = value.max(0.0).min(100.0);
    (bounded * 100.0).round() / 100.0
}

fn round_day(t: f64) -> i64 {
    (t / DAY_MS).round() as i64
}

fn poll_se(point: &PollObservation) -> f64 {
    if let Some(moe) = point.moe.filter(|v| v.is_finite() && *v > 0.0) {
        return (moe / 1.96).max(0.4);
    }

    let mut y = if point.y.is_nan() || point.y == 0.0 {
        30.0
    } else {
        point.y
    };
    y = y.max(5.0).min(95.0);

    let n = sample_size(point.n);
    (DEFF * (y * (100.0 - y) / n).sqrt()).max(0.5)
}

fn recency_weight(days: f64, half: f64) -> f64 {
    let effective_half = half.max(1.0);
    2.0_f64.powf(-days.max(0.0) / effective_half)
}

fn flood_index(points: &[PollObservation], half: f64) -> BTreeMap<(String, i64), f64> {
    let span = FLOOD_DAYS.max(half).ceil() as i64;
    let mut index = BTreeMap::new();
    for point in points {
        let institute = match point.institute.as_deref() {
            Some(value) if !value.is_empty() => value,
            _ => continue,
        };
        let day = round_day(point.t);
        for offset in -span..=span {
            let key = (institute.to_string(), day + offset);
            *index.entry(key).or_insert(0.0) += 1.0;
        }
    }
    index
}

fn flood_k(index: &BTreeMap<(String, i64), f64>, institute: Option<&str>, t: f64) -> f64 {
    let Some(institute) = institute.filter(|value| !value.is_empty()) else {
        return 1.0;
    };
    index
        .get(&(institute.to_string(), round_day(t)))
        .copied()
        .unwrap_or(0.0)
        .max(1.0)
}

pub fn dl_tau2(items: &[(f64, f64)]) -> f64 {
    if items.is_empty() {
        return 0.0;
    }

    let mut sw = 0.0;
    let mut swy = 0.0;
    for &(y, se) in items {
        let w = 1.0 / (se * se).max(1e-6);
        sw += w;
        swy += w * y;
    }
    if sw <= 0.0 {
        return 0.0;
    }

    let mu = swy / sw;
    let mut q = 0.0;
    let mut sw2 = 0.0;
    for &(y, se) in items {
        let w = 1.0 / (se * se).max(1e-6);
        let d = y - mu;
        q += w * d * d;
        sw2 += w * w;
    }

    let df = items.len().saturating_sub(1).max(1) as f64;
    let c = sw - sw2 / sw;
    let tau = if c > 0.0 {
        ((q - df) / c).max(0.0)
    } else {
        0.0
    };
    tau.min(25.0)
}

pub fn weighted_trend_v3(points: &[PollObservation], window_days: f64) -> Vec<SeriesPoint> {
    if points.is_empty() {
        return Vec::new();
    }

    let mut sorted = points.to_vec();
    sorted.sort_by(|a, b| a.t.total_cmp(&b.t));
    let half = normalized_half(window_days, 1.0, 14.0);
    let reach = half * 2.5;
    let t_min = sorted[0].t;
    let t_max = sorted.last().unwrap().t;
    let flood = flood_index(&sorted, half);
    let mut out = Vec::new();

    let mut t = t_min;
    while t <= t_max {
        let mut bag: Vec<(f64, f64, f64)> = Vec::new();
        let mut nearest = f64::INFINITY;

        for point in &sorted {
            let days = (t - point.t).abs() / DAY_MS;
            if days < nearest {
                nearest = days;
            }
            if days > reach {
                continue;
            }
            bag.push((
                point.y,
                poll_se(point),
                recency_weight(days, half) / flood_k(&flood, point.institute.as_deref(), t),
            ));
        }

        if !bag.is_empty() && nearest <= half {
            let tau2 = dl_tau2(&bag.iter().map(|(y, se, _)| (*y, *se)).collect::<Vec<_>>());
            let mut numerator = 0.0;
            let mut denominator = 0.0;
            for &(y, se, rw) in &bag {
                let w = rw / (se * se + tau2);
                numerator += w * y;
                denominator += w;
            }
            if denominator > 0.0 {
                out.push(SeriesPoint {
                    x: t,
                    y: (numerator / denominator * 100.0).round() / 100.0,
                });
            }
        }

        t += DAY_MS;
    }

    out
}

pub fn weighted_trend_v4(points: &[PollObservation], _window_days: f64) -> Vec<SeriesPoint> {
    if points.is_empty() {
        return Vec::new();
    }

    let house = estimate_house_effects(points, 14.0);
    let mut sorted = points.to_vec();
    for point in &mut sorted {
        let adjustment = point
            .institute
            .as_deref()
            .and_then(|key| house.get(key))
            .copied()
            .unwrap_or(0.0);
        point.y -= adjustment;
    }
    sorted.sort_by(|a, b| a.t.total_cmp(&b.t));

    let t_min = sorted[0].t;
    let t_max = sorted.last().unwrap().t;
    let q = 0.16 * 0.16;

    let mut by_day: BTreeMap<i64, Vec<PollObservation>> = BTreeMap::new();
    for point in &sorted {
        by_day.entry(round_day(point.t)).or_default().push(point.clone());
    }

    let mut theta = sorted[0].y;
    let mut p = 9.0;
    let mut forward: Vec<(f64, f64, f64)> = Vec::new();

    let mut t = t_min;
    while t <= t_max {
        p += q;
        let day = round_day(t);
        if let Some(bucket) = by_day.get(&day) {
            for point in bucket {
                let r = poll_se(point).powi(2);
                let k = p / (p + r);
                theta += k * (point.y - theta);
                p = (1.0 - k) * p;
            }
        }
        forward.push((t, theta, p));
        t += DAY_MS;
    }

    let mut smooth = vec![(0.0, 0.0); forward.len()];
    let last = forward.len() - 1;
    smooth[last] = (forward[last].1, forward[last].2);

    for i in (0..last).rev() {
        let p_pred = forward[i].2 + q;
        let c = forward[i].2 / p_pred.max(1e-9);
        let m = forward[i].1 + c * (smooth[i + 1].0 - forward[i].1);
        let variance = forward[i].2 + c * c * (smooth[i + 1].1 - p_pred);
        smooth[i] = (m, variance);
    }

    forward
        .iter()
        .enumerate()
        .map(|(i, &(x, _, _))| SeriesPoint {
            x,
            y: round2_clamped(smooth[i].0),
        })
        .collect()
}

pub fn weighted_trend_v5(points: &[PollObservation], window_days: f64) -> Vec<SeriesPoint> {
    if points.is_empty() {
        return Vec::new();
    }

    let mut sorted = points.to_vec();
    sorted.sort_by(|a, b| a.t.total_cmp(&b.t));
    let half = ((if window_days.is_finite() && window_days != 0.0 {
        window_days
    } else {
        14.0
    }) / 5.0)
        .max(2.0);
    let reach = (half * 4.0).max(8.0);
    let t_min = sorted[0].t;
    let t_max = sorted.last().unwrap().t;
    let mut out = Vec::new();

    let mut t = t_min;
    while t <= t_max {
        let mut numerator = 0.0;
        let mut denominator = 0.0;
        let mut nearest = f64::INFINITY;

        for point in &sorted {
            let days = (t - point.t).abs() / DAY_MS;
            if days < nearest {
                nearest = days;
            }
            if days > reach {
                continue;
            }
            let size_w = (sample_size(point.n) / N_REF).sqrt();
            let recency = 2.0_f64.powf(-days / half);
            let punch = 1.0 + 2.0 * (-days / 1.8).exp();
            let weight = size_w * recency * punch;
            numerator += weight * point.y;
            denominator += weight;
        }

        if denominator > 0.0 && nearest <= (3.0_f64).max(half * 1.5) {
            out.push(SeriesPoint {
                x: t,
                y: (numerator / denominator * 100.0).round() / 100.0,
            });
        }

        t += DAY_MS;
    }

    out
}

pub fn weighted_trend_v6(points: &[PollObservation]) -> Vec<SeriesPoint> {
    if points.is_empty() {
        return Vec::new();
    }

    let mut by_day: BTreeMap<i64, BTreeMap<String, (f64, f64)>> = BTreeMap::new();
    for point in points {
        if !point.y.is_finite() {
            continue;
        }
        let day = round_day(point.t);
        let institute = point.institute.clone().unwrap_or_else(|| "_".to_string());
        let w = (sample_size(point.n) / N_REF).sqrt();
        let bucket = by_day.entry(day).or_default();
        if let Some((current_y, current_w)) = bucket.get(&institute).copied() {
            let new_w = current_w + w;
            let new_y = (current_y * current_w + point.y * w) / new_w;
            bucket.insert(institute, (new_y, new_w));
        } else {
            bucket.insert(institute, (point.y, w));
        }
    }

    by_day
        .into_iter()
        .filter_map(|(day, bucket)| {
            let mut numerator = 0.0;
            let mut denominator = 0.0;
            for (_, (y, w)) in bucket {
                numerator += w * y;
                denominator += w;
            }
            (denominator > 0.0).then(|| SeriesPoint {
                x: day as f64 * DAY_MS,
                y: (numerator / denominator * 100.0).round() / 100.0,
            })
        })
        .collect()
}

pub fn weighted_trend_v7(points: &[PollObservation], window_days: f64) -> Vec<SeriesPoint> {
    let mut sorted: Vec<PollObservation> = points
        .iter()
        .filter(|point| point.y.is_finite())
        .cloned()
        .collect();
    if sorted.is_empty() {
        return Vec::new();
    }

    sorted.sort_by(|a, b| a.t.total_cmp(&b.t));
    let half = normalized_half(window_days, 3.0, 14.0);
    let t_min = sorted[0].t;
    let t_max = sorted.last().unwrap().t;
    let mut out = Vec::new();

    let mut t = t_min;
    while t <= t_max {
        let mut sw = 0.0;
        let mut sx = 0.0;
        let mut sy = 0.0;
        let mut sxx = 0.0;
        let mut sxy = 0.0;
        let mut nearest = f64::INFINITY;
        let mut nfit = 0usize;

        for point in &sorted {
            let days = (point.t - t) / DAY_MS;
            let ad = days.abs();
            if ad < nearest {
                nearest = ad;
            }
            if ad > half {
                continue;
            }
            let u = ad / half;
            let tricube = (1.0 - u * u * u).powi(3);
            let k = tricube * (sample_size(point.n) / N_REF).sqrt();
            if k <= 0.0 {
                continue;
            }
            sw += k;
            sx += k * days;
            sy += k * point.y;
            sxx += k * days * days;
            sxy += k * days * point.y;
            nfit += 1;
        }

        if sw > 0.0 && nearest <= half {
            let determinant = sw * sxx - sx * sx;
            let mut y = sy / sw;
            if nfit >= 3 && determinant > 1e-6 {
                y = (sxx * sy - sx * sxy) / determinant;
            }
            out.push(SeriesPoint {
                x: t,
                y: round2_clamped(y),
            });
        }

        t += DAY_MS;
    }

    out
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SchoolKind {
    Mean,
    Weight,
    Median,
    Mode,
    Trim,
}

fn collapse_day(points: &[PollObservation]) -> Vec<(f64, f64)> {
    let mut bag: BTreeMap<String, (f64, f64)> = BTreeMap::new();

    for point in points {
        if !point.y.is_finite() {
            continue;
        }
        let institute = point.institute.clone().unwrap_or_else(|| "_".to_string());
        let w = (sample_size(point.n) / N_REF).sqrt();

        if let Some((current_y, current_w)) = bag.get(&institute).copied() {
            let new_w = current_w + w;
            let new_y = (current_y * current_w + point.y * w) / new_w;
            bag.insert(institute, (new_y, new_w));
        } else {
            bag.insert(institute, (point.y, w));
        }
    }

    bag.into_values().collect()
}

fn median_of(values: &[f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.total_cmp(b));
    let mid = sorted.len() / 2;
    if sorted.len() % 2 == 1 {
        sorted[mid]
    } else {
        (sorted[mid - 1] + sorted[mid]) / 2.0
    }
}

fn mode_of(values: &[f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }

    let mut bins: BTreeMap<i64, usize> = BTreeMap::new();
    for &value in values {
        let bin = (value * 2.0).round() as i64;
        *bins.entry(bin).or_insert(0) += 1;
    }

    let best = bins.values().copied().max().unwrap_or(0);
    if best <= 1 {
        return median_of(values);
    }

    let winners: Vec<f64> = bins
        .into_iter()
        .filter_map(|(bin, count)| (count == best).then_some(bin as f64 / 2.0))
        .collect();
    median_of(&winners)
}

fn trim_mean(values: &[f64]) -> f64 {
    if values.len() < 4 {
        return median_of(values);
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.total_cmp(b));
    let drop = 1usize.max((sorted.len() as f64 * 0.2).floor() as usize);
    let end = sorted.len().saturating_sub(drop);
    if drop >= end {
        return median_of(&sorted);
    }
    let core = &sorted[drop..end];
    core.iter().sum::<f64>() / core.len() as f64
}

fn reduce_school(rows: &[(f64, f64)], kind: SchoolKind) -> Option<f64> {
    if rows.is_empty() {
        return None;
    }

    match kind {
        SchoolKind::Mean => Some(rows.iter().map(|(y, _)| *y).sum::<f64>() / rows.len() as f64),
        SchoolKind::Weight => {
            let numerator = rows.iter().map(|(y, w)| y * w).sum::<f64>();
            let denominator = rows.iter().map(|(_, w)| *w).sum::<f64>();
            (denominator > 0.0).then_some(numerator / denominator)
        }
        SchoolKind::Median => {
            let values: Vec<f64> = rows.iter().map(|(y, _)| *y).collect();
            Some(median_of(&values))
        }
        SchoolKind::Mode => {
            let values: Vec<f64> = rows.iter().map(|(y, _)| *y).collect();
            Some(mode_of(&values))
        }
        SchoolKind::Trim => {
            let values: Vec<f64> = rows.iter().map(|(y, _)| *y).collect();
            Some(trim_mean(&values))
        }
    }
}

pub fn school_center_trend(
    points: &[PollObservation],
    window_days: f64,
    kind: SchoolKind,
) -> Vec<SeriesPoint> {
    let mut sorted: Vec<PollObservation> = points
        .iter()
        .filter(|point| point.y.is_finite())
        .cloned()
        .collect();
    if sorted.is_empty() {
        return Vec::new();
    }

    sorted.sort_by(|a, b| a.t.total_cmp(&b.t));
    let half = normalized_half(window_days, 1.0, 14.0);
    let t_min = sorted[0].t;
    let t_max = sorted.last().unwrap().t;
    let mut out = Vec::new();

    let mut t = t_min;
    while t <= t_max {
        let mut bag = Vec::new();
        let mut nearest = f64::INFINITY;
        for point in &sorted {
            let days = (t - point.t).abs() / DAY_MS;
            if days < nearest {
                nearest = days;
            }
            if days <= half {
                bag.push(point.clone());
            }
        }

        if !bag.is_empty() && nearest <= half {
            if let Some(y) = reduce_school(&collapse_day(&bag), kind) {
                if y.is_finite() {
                    out.push(SeriesPoint {
                        x: t,
                        y: round2_clamped(y),
                    });
                }
            }
        }

        t += DAY_MS;
    }

    out
}

pub fn weighted_trend_v8(points: &[PollObservation], window_days: f64) -> Vec<SeriesPoint> {
    school_center_trend(points, window_days, SchoolKind::Mean)
}

pub fn weighted_trend_v9(points: &[PollObservation], window_days: f64) -> Vec<SeriesPoint> {
    school_center_trend(points, window_days, SchoolKind::Weight)
}

pub fn weighted_trend_v10(points: &[PollObservation], window_days: f64) -> Vec<SeriesPoint> {
    school_center_trend(points, window_days, SchoolKind::Median)
}

pub fn weighted_trend_v11(points: &[PollObservation], window_days: f64) -> Vec<SeriesPoint> {
    school_center_trend(points, window_days, SchoolKind::Mode)
}

pub fn weighted_trend_v12(points: &[PollObservation], window_days: f64) -> Vec<SeriesPoint> {
    school_center_trend(points, window_days, SchoolKind::Trim)
}

pub fn average_trend_advanced(
    points: &[PollObservation],
    window_days: f64,
    model: u8,
) -> Vec<SeriesPoint> {
    match model {
        12 => weighted_trend_v12(points, window_days),
        11 => weighted_trend_v11(points, window_days),
        10 => weighted_trend_v10(points, window_days),
        9 => weighted_trend_v9(points, window_days),
        8 => weighted_trend_v8(points, window_days),
        7 => weighted_trend_v7(points, window_days),
        6 => weighted_trend_v6(points),
        5 => weighted_trend_v5(points, window_days),
        4 => weighted_trend_v4(points, window_days),
        _ => weighted_trend_v3(points, window_days),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn constant_rows() -> Vec<PollObservation> {
        (0..10)
            .map(|day| PollObservation {
                t: day as f64 * DAY_MS,
                y: 40.0,
                n: Some(2000.0),
                institute: Some("A".into()),
                moe: None,
            })
            .collect()
    }

    #[test]
    fn poll_se_preserves_moe_floor_and_design_effect_fallback() {
        let with_moe = PollObservation {
            t: 0.0,
            y: 40.0,
            n: Some(2000.0),
            institute: None,
            moe: Some(1.0),
        };
        assert!((poll_se(&with_moe) - 0.5102040816326531).abs() < 1e-12);

        let fallback = PollObservation {
            t: 0.0,
            y: 50.0,
            n: Some(2000.0),
            institute: None,
            moe: None,
        };
        let expected = 1.3 * (2500.0_f64 / 2000.0).sqrt();
        assert!((poll_se(&fallback) - expected).abs() < 1e-12);
    }

    #[test]
    fn dl_tau2_matches_capped_random_effects_variance() {
        assert!((dl_tau2(&[(40.0, 1.0), (60.0, 1.0)]) - 25.0).abs() < 1e-12);
        assert!((dl_tau2(&[(40.0, 2.0), (40.0, 2.0)]) - 0.0).abs() < 1e-12);
    }

    #[test]
    fn all_advanced_models_preserve_a_constant_series() {
        let rows = constant_rows();
        for model in 3..=12 {
            let trend = average_trend_advanced(&rows, 14.0, model);
            assert!(!trend.is_empty(), "model {model} returned no trend");
            assert!(trend.iter().all(|point| (point.y - 40.0).abs() < 1e-12), "model {model} drifted");
        }
    }

    #[test]
    fn school_models_preserve_institute_collapse_semantics() {
        let rows = vec![
            PollObservation { t: 0.0, y: 40.0, n: Some(2000.0), institute: Some("A".into()), moe: None },
            PollObservation { t: 0.0, y: 42.0, n: Some(2000.0), institute: Some("A".into()), moe: None },
            PollObservation { t: 0.0, y: 50.0, n: Some(2000.0), institute: Some("B".into()), moe: None },
        ];
        assert_eq!(weighted_trend_v6(&rows).last().map(|p| p.y), Some(44.0));
        assert_eq!(weighted_trend_v8(&rows, 14.0).last().map(|p| p.y), Some(44.0));
        assert_eq!(weighted_trend_v9(&rows, 14.0).last().map(|p| p.y), Some(44.0));
        assert_eq!(weighted_trend_v10(&rows, 14.0).last().map(|p| p.y), Some(45.5));
        assert_eq!(weighted_trend_v11(&rows, 14.0).last().map(|p| p.y), Some(45.5));
        assert_eq!(weighted_trend_v12(&rows, 14.0).last().map(|p| p.y), Some(45.5));
    }

    #[test]
    fn local_linear_model_recovers_a_daily_linear_series_at_the_endpoint() {
        let rows: Vec<PollObservation> = (0..6)
            .map(|day| PollObservation {
                t: day as f64 * DAY_MS,
                y: 39.0 + day as f64,
                n: Some(2000.0),
                institute: Some("A".into()),
                moe: None,
            })
            .collect();
        let trend = weighted_trend_v7(&rows, 14.0);
        assert_eq!(trend.last().map(|point| point.y), Some(44.0));
    }
}
