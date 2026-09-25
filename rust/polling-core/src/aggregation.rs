use crate::{poll_weight, PollObservation};

const DAY_MS: f64 = 86_400_000.0;

#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct SeriesPoint {
    pub x: f64,
    pub y: f64,
}

/// Canonical daily weighted trend corresponding to production weightedTrendV1.
///
/// The production contract is deliberately preserved here: sample-size weighting,
/// exponential recency weighting, a 2.5 × half-life inclusion reach, a nearest-point
/// visibility gate, and two-decimal output rounding.
pub fn weighted_trend_v1(points: &[PollObservation], window_days: f64) -> Vec<SeriesPoint> {
    if points.is_empty() {
        return Vec::new();
    }

    let mut sorted: Vec<&PollObservation> = points.iter().collect();
    sorted.sort_by(|a, b| a.t.total_cmp(&b.t));

    let t_min = sorted[0].t;
    let t_max = sorted[sorted.len() - 1].t;
    let requested = if window_days.is_finite() && window_days != 0.0 {
        window_days
    } else {
        14.0
    };
    let half = requested.max(1.0);
    let reach = half * 2.5;
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
            let weight = poll_weight(point, t, half, 1.0).total;
            numerator += weight * point.y;
            denominator += weight;
        }

        if denominator > 0.0 && nearest <= half {
            out.push(SeriesPoint {
                x: t,
                y: (numerator / denominator * 100.0).round() / 100.0,
            });
        }
        t += DAY_MS;
    }

    out
}


/// Canonical daily weighted trend corresponding to production weightedTrendV2.
/// Adds the existing institute/day flood divisor before applying canonical poll weighting.
pub fn weighted_trend_v2(points: &[PollObservation], window_days: f64) -> Vec<SeriesPoint> {
    if points.is_empty() { return Vec::new(); }
    let mut sorted: Vec<&PollObservation> = points.iter().collect();
    sorted.sort_by(|a, b| a.t.total_cmp(&b.t));
    let requested = if window_days.is_finite() && window_days != 0.0 { window_days } else { 14.0 };
    let half = requested.max(1.0);
    let reach = half * 2.5;
    let span = half.max(14.0).ceil() as i64;
    let mut flood_index = std::collections::BTreeMap::<String, f64>::new();
    for point in &sorted {
        let institute = match point.institute.as_deref() {
            Some(value) if !value.is_empty() => value,
            _ => continue,
        };
        let day = (point.t / DAY_MS).round() as i64;
        for offset in -span..=span {
            let key = format!("{institute}\u{0000}{}", day + offset);
            *flood_index.entry(key).or_insert(0.0) += 1.0;
        }
    }
    let t_min = sorted[0].t;
    let t_max = sorted[sorted.len() - 1].t;
    let mut out = Vec::new();
    let mut t = t_min;
    while t <= t_max {
        let mut numerator = 0.0;
        let mut denominator = 0.0;
        let mut nearest = f64::INFINITY;
        for point in &sorted {
            let days = (t - point.t).abs() / DAY_MS;
            if days < nearest { nearest = days; }
            if days > reach { continue; }
            let flood = point.institute.as_deref()
                .filter(|value| !value.is_empty())
                .map(|institute| {
                    let day = (t / DAY_MS).round() as i64;
                    flood_index.get(&format!("{institute}\u{0000}{day}")).copied().unwrap_or(1.0)
                })
                .unwrap_or(1.0);
            let weight = poll_weight(point, t, half, flood).total;
            numerator += weight * point.y;
            denominator += weight;
        }
        if denominator > 0.0 && nearest <= half {
            out.push(SeriesPoint { x: t, y: (numerator / denominator * 100.0).round() / 100.0 });
        }
        t += DAY_MS;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weighted_v2_applies_institute_flood_divisor() {
        let rows = vec![
            PollObservation { t: 0.0, y: 40.0, n: Some(2000.0), institute: Some("A".into()), moe: None },
            PollObservation { t: 0.0, y: 42.0, n: Some(2000.0), institute: Some("A".into()), moe: None },
            PollObservation { t: 0.0, y: 50.0, n: Some(2000.0), institute: Some("B".into()), moe: None },
        ];
        let trend = weighted_trend_v2(&rows, 14.0);
        assert_eq!(trend.last().map(|p| p.y), Some(45.5));
    }

    #[test]
    fn matches_existing_real_fixture_value() {
        let rows = vec![
            PollObservation { t: 0.0, y: 41.76, n: Some(40500.0), institute: Some("Veritá".into()), moe: None },
            PollObservation { t: -DAY_MS * 2.0, y: 39.0, n: Some(2002.0), institute: Some("Datafolha".into()), moe: None },
            PollObservation { t: -DAY_MS * 3.0, y: 44.1, n: Some(5018.0), institute: Some("AtlasIntel".into()), moe: None },
            PollObservation { t: -DAY_MS * 3.0, y: 37.0, n: Some(2400.0), institute: Some("Gerp".into()), moe: None },
            PollObservation { t: -DAY_MS * 3.0, y: 37.0, n: Some(3000.0), institute: Some("PoderData".into()), moe: None },
            PollObservation { t: -DAY_MS * 4.0, y: 38.3, n: Some(2000.0), institute: Some("Futura/Apex".into()), moe: None },
            PollObservation { t: -DAY_MS * 5.0, y: 39.0, n: Some(2000.0), institute: Some("DataTrends".into()), moe: None },
            PollObservation { t: -DAY_MS * 6.0, y: 40.5, n: Some(2002.0), institute: Some("CNT/MDA".into()), moe: None },
        ];
        let trend = weighted_trend_v1(&rows, 14.0);
        assert_eq!(trend.last().map(|p| p.x), Some(0.0));
        assert!((trend.last().unwrap().y - 39.84).abs() < 0.005);
    }
}
