use crate::{sample_size, PollObservation, N_REF};

const DAY_MS: f64 = 86_400_000.0;

/// Estimate per-institute house effects against contemporaneous peers.
/// This preserves the existing production formula used by aggregate/model 2/projection-v2.
pub fn estimate_house_effects(points: &[PollObservation], peer_days: f64) -> std::collections::BTreeMap<String, f64> {
    let peer_days = if peer_days.is_finite() { peer_days.max(0.0) } else { 14.0 };
    let mut acc: std::collections::BTreeMap<String, (f64, f64)> = std::collections::BTreeMap::new();

    for point in points {
        if !point.y.is_finite() { continue; }
        let institute = match point.institute.as_deref() {
            Some(value) if !value.is_empty() => value,
            _ => continue,
        };
        let mut num = 0.0;
        let mut den = 0.0;
        for peer in points {
            if !peer.y.is_finite() { continue; }
            let peer_institute = match peer.institute.as_deref() {
                Some(value) if !value.is_empty() => value,
                _ => continue,
            };
            if peer_institute == institute { continue; }
            let days = (peer.t - point.t).abs() / DAY_MS;
            if days > peer_days { continue; }
            let w = (sample_size(peer.n) / N_REF).sqrt();
            num += w * peer.y;
            den += w;
        }
        if den <= 0.0 { continue; }
        let entry = acc.entry(institute.to_string()).or_insert((0.0, 0.0));
        entry.0 += point.y - num / den;
        entry.1 += 1.0;
    }

    acc.into_iter()
        .map(|(key, (sum, count))| {
            let raw = sum / count;
            let value = if raw.abs() < 0.05 { 0.0 } else { raw * (count / (count + 4.0)) };
            (key, value)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ignores_missing_institute() {
        let rows = vec![PollObservation { t: 0.0, y: 40.0, n: Some(2000.0), institute: None, moe: None }];
        assert!(estimate_house_effects(&rows, 14.0).is_empty());
    }

    #[test]
    fn uses_same_weighted_peer_formula() {
        let rows = vec![
            PollObservation { t: 0.0, y: 42.0, n: Some(2000.0), institute: Some("A".into()), moe: None },
            PollObservation { t: 0.0, y: 40.0, n: Some(2000.0), institute: Some("B".into()), moe: None },
        ];
        let result = estimate_house_effects(&rows, 14.0);
        assert!((result["A"] - 0.4).abs() < 1e-12);
        assert!((result["B"] + 0.4).abs() < 1e-12);
    }
}
