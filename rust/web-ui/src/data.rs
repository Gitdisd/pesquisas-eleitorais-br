use gloo_net::http::Request;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

pub use polling_core::{
    candidate_key, canonical_poll_key, fallback_poll_key, is_first_round, is_second_round,
    normalize_geo, normalize_identity_text, tse_protocol_of, Candidate, IdentityFields,
};

const DATA_URL: &str = "data/polls.json";
const EXTRA_DATA_URL: &str = "data/polls-extra.json";
const REGIONAL_DATA_URL: &str = "data/polls-regional.json";

#[derive(Clone, Debug, Deserialize)]
pub struct CandidateResult {
    pub name: String,
    pub pct: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[allow(dead_code)]
pub struct RawPoll {
    pub institute: String,
    pub fieldwork_start: Option<String>,
    pub fieldwork_end: String,
    pub published_date: Option<String>,
    pub scenario: String,
    pub candidates: Vec<CandidateResult>,
    pub n: Option<f64>,
    pub margin_of_error: Option<serde_json::Value>,
    pub source_url: String,
    pub methodology_note: Option<String>,
    pub verified: Option<bool>,
    pub tse_registration: Option<String>,
    pub tse_protocol: Option<String>,
    pub geo: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(untagged)]
enum PollPayload {
    Rows(Vec<RawPoll>),
    Wrapped { polls: Vec<RawPoll> },
}

fn raw_rows(payload: PollPayload) -> Vec<RawPoll> {
    match payload {
        PollPayload::Rows(rows) => rows,
        PollPayload::Wrapped { polls } => polls,
    }
}

fn identity_fields(row: &RawPoll) -> IdentityFields {
    IdentityFields {
        institute: row.institute.clone(),
        fieldwork_start: row.fieldwork_start.clone(),
        fieldwork_end: Some(row.fieldwork_end.clone()),
        published_date: row.published_date.clone(),
        scenario: row.scenario.clone(),
        geo: row.geo.clone(),
        tse_registration: row.tse_registration.clone(),
        tse_protocol: row.tse_protocol.clone(),
        methodology_note: row.methodology_note.clone(),
        ..IdentityFields::default()
    }
}

fn valid_iso_date(value: Option<&str>) -> Option<String> {
    let value = value?;
    if parse_day(value).is_some() {
        Some(value[..10].to_string())
    } else {
        None
    }
}

fn earliest_date(a: Option<&str>, b: Option<&str>) -> Option<String> {
    [valid_iso_date(a), valid_iso_date(b)]
        .into_iter()
        .flatten()
        .min()
}

fn merge_candidates(base: &[CandidateResult], extra: &[CandidateResult]) -> Vec<CandidateResult> {
    let mut seen = BTreeSet::<String>::new();
    let mut merged = Vec::new();

    for candidate in base.iter().chain(extra.iter()) {
        if candidate.name.trim().is_empty() || !candidate.pct.is_finite() {
            continue;
        }
        let key = normalize_identity_text(&candidate.name);
        if seen.insert(key) {
            merged.push(candidate.clone());
        }
    }

    merged
}

fn merge_raw_poll(current: &RawPoll, incoming: &RawPoll) -> RawPoll {
    let mut merged = current.clone();
    merged.candidates = merge_candidates(&current.candidates, &incoming.candidates);
    merged.verified = Some(current.verified == Some(true) || incoming.verified == Some(true));

    if let Some(published) =
        earliest_date(current.published_date.as_deref(), incoming.published_date.as_deref())
    {
        merged.published_date = Some(published);
    }

    merged.source_url = if !current.source_url.is_empty() {
        current.source_url.clone()
    } else {
        incoming.source_url.clone()
    };

    let methodology = [current.methodology_note.as_deref(), incoming.methodology_note.as_deref()]
        .into_iter()
        .flatten()
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .fold(Vec::<String>::new(), |mut values, value| {
            if !values.contains(&value) {
                values.push(value);
            }
            values
        })
        .join(" | ");
    merged.methodology_note = (!methodology.is_empty()).then_some(methodology);

    if current.geo.is_some() || incoming.geo.is_some() {
        merged.geo = Some(normalize_geo(
            current.geo.as_deref().or(incoming.geo.as_deref()),
        ));
    }

    let protocol = tse_protocol_of(&identity_fields(&merged));
    if protocol.is_some() {
        merged.tse_registration = protocol;
    } else if merged.tse_registration.is_none() {
        merged.tse_registration = incoming.tse_registration.clone();
    }

    merged
}

fn merge_raw_polls(base: Vec<RawPoll>, extra: Vec<RawPoll>) -> Vec<RawPoll> {
    let mut map = BTreeMap::<String, RawPoll>::new();
    let mut fallback_index = BTreeMap::<String, Vec<String>>::new();

    fn remember(index: &mut BTreeMap<String, Vec<String>>, fallback: String, key: String) {
        let values = index.entry(fallback).or_default();
        if !values.contains(&key) {
            values.push(key);
        }
    }

    for row in base.into_iter().filter(|row| {
        !row.institute.is_empty() && !row.fieldwork_end.is_empty() && !row.scenario.is_empty()
    }) {
        let fields = identity_fields(&row);
        let key = canonical_poll_key(&fields);
        remember(&mut fallback_index, fallback_poll_key(&fields), key.clone());
        map.insert(key, row);
    }

    for row in extra.into_iter().filter(|row| {
        !row.institute.is_empty() && !row.fieldwork_end.is_empty() && !row.scenario.is_empty()
    }) {
        let fields = identity_fields(&row);
        let key = canonical_poll_key(&fields);
        let fallback = fallback_poll_key(&fields);
        let matching_key = if map.contains_key(&key) {
            Some(key.clone())
        } else {
            fallback_index
                .get(&fallback)
                .filter(|values| values.len() == 1)
                .and_then(|values| values.first().cloned())
        };

        let Some(current_key) = matching_key else {
            remember(&mut fallback_index, fallback, key.clone());
            map.insert(key, row);
            continue;
        };

        let current = map.remove(&current_key).expect("matching poll key");
        let merged = merge_raw_poll(&current, &row);
        let merged_fields = identity_fields(&merged);
        let final_key = canonical_poll_key(&merged_fields);
        remember(
            &mut fallback_index,
            fallback_poll_key(&merged_fields),
            final_key.clone(),
        );
        map.insert(final_key, merged);
    }

    map.into_values().collect()
}

#[derive(Clone, Debug, Serialize)]
pub struct Poll {
    pub id: String,
    pub institute: String,
    pub fieldwork_start: Option<String>,
    pub fieldwork_end: String,
    pub published_date: Option<String>,
    pub scenario: String,
    pub n: f64,
    pub geo: String,
    pub source_url: String,
    pub tse_registration: Option<String>,
    pub verified: bool,
    pub moe: Option<f64>,
    pub candidate_key: String,
    pub value: f64,
    pub round: u8,
    pub day: i64,
}

fn parse_moe_value(value: &Option<serde_json::Value>) -> Option<f64> {
    match value {
        Some(serde_json::Value::Number(number)) => number.as_f64(),
        Some(serde_json::Value::String(text)) => {
            let normalized = text.replace(',', ".");
            let mut token = String::new();
            let mut started = false;
            let mut decimal = false;

            for ch in normalized.chars() {
                if ch.is_ascii_digit() {
                    started = true;
                    token.push(ch);
                } else if ch == '.' && started && !decimal {
                    decimal = true;
                    token.push(ch);
                } else if started {
                    break;
                }
            }

            if token.is_empty() { None } else { token.parse::<f64>().ok() }
        }
        _ => None,
    }
}

pub async fn load_polls(refresh_nonce: u64) -> Result<Vec<Poll>, String> {
    let data_url = format!("{DATA_URL}?v={refresh_nonce}");
    let extra_url = format!("{EXTRA_DATA_URL}?v={refresh_nonce}");

    let payload = Request::get(&data_url)
        .send()
        .await
        .map_err(|err| format!("Falha ao buscar pesquisas: {err}"))?
        .json::<PollPayload>()
        .await
        .map_err(|err| format!("JSON inválido: {err}"))?;

    let extra = match Request::get(&extra_url).send().await {
        Ok(response) => response
            .json::<PollPayload>()
            .await
            .map(raw_rows)
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    };

    let rows = merge_raw_polls(raw_rows(payload), extra);

    let mut out = Vec::new();
    for row in rows.into_iter() {
        let day = match parse_day(&row.fieldwork_end) {
            Some(day) => day,
            None => continue,
        };
        let round = if is_second_round(&row.scenario) {
            2
        } else if is_first_round(&row.scenario) {
            1
        } else {
            continue
        };
        let geo = normalize_geo(row.geo.as_deref());

        for candidate in &row.candidates {
            let key = candidate_key(&candidate.name);
            if key.is_empty() || !candidate.pct.is_finite() {
                continue;
            }
            let identity = identity_fields(&row);
            let id = canonical_poll_key(&identity);
            out.push(Poll {
                id,
                institute: row.institute.clone(),
                fieldwork_start: row.fieldwork_start.clone(),
                fieldwork_end: row.fieldwork_end.clone(),
                published_date: row.published_date.clone(),
                scenario: row.scenario.clone(),
                n: row.n.unwrap_or(800.0),
                geo: geo.clone(),
                source_url: row.source_url.clone(),
                tse_registration: row.tse_registration.clone().or(row.tse_protocol.clone()),
                verified: row.verified.unwrap_or(false),
                moe: parse_moe_value(&row.margin_of_error),
                candidate_key: key,
                value: candidate.pct,
                round,
                day,
            });
        }
    }

    out.sort_by(|a, b| {
        a.day
            .cmp(&b.day)
            .then_with(|| a.institute.cmp(&b.institute))
            .then_with(|| a.candidate_key.cmp(&b.candidate_key))
    });
    Ok(out)
}


pub async fn load_regional_polls(refresh_nonce: u64) -> Result<Vec<Poll>, String> {
    let url = format!("{REGIONAL_DATA_URL}?v={refresh_nonce}");
    let response = Request::get(&url)
        .send()
        .await
        .map_err(|err| format!("Falha ao buscar pesquisas regionais: {err}"))?;
    if !response.ok() {
        return Err(format!("Pesquisas regionais HTTP {}", response.status()));
    }
    let payload = response
        .json::<PollPayload>()
        .await
        .map_err(|err| format!("JSON regional inválido: {err}"))?;

    let mut out = Vec::new();
    for row in raw_rows(payload) {
        let day = match parse_day(&row.fieldwork_end) {
            Some(day) => day,
            None => continue,
        };
        let round = if is_second_round(&row.scenario) {
            2
        } else if is_first_round(&row.scenario) {
            1
        } else {
            continue;
        };
        let geo = normalize_geo(row.geo.as_deref());

        for candidate in &row.candidates {
            let key = candidate_key(&candidate.name);
            if key.is_empty() || !candidate.pct.is_finite() {
                continue;
            }
            let id = canonical_poll_key(&identity_fields(&row));
            out.push(Poll {
                id,
                institute: row.institute.clone(),
                fieldwork_start: row.fieldwork_start.clone(),
                fieldwork_end: row.fieldwork_end.clone(),
                published_date: row.published_date.clone(),
                scenario: row.scenario.clone(),
                n: row.n.unwrap_or(800.0),
                geo: geo.clone(),
                source_url: row.source_url.clone(),
                tse_registration: row.tse_registration.clone().or(row.tse_protocol.clone()),
                moe: parse_moe_value(&row.margin_of_error),
                candidate_key: key,
                value: candidate.pct,
                round,
                day,
            });
        }
    }

    out.sort_by(|a, b| {
        a.day
            .cmp(&b.day)
            .then_with(|| a.institute.cmp(&b.institute))
            .then_with(|| a.candidate_key.cmp(&b.candidate_key))
    });
    Ok(out)
}


pub fn filter_polls(
    polls: &[Poll],
    candidate: Candidate,
    round: u8,
    geo: &str,
    range_days: Option<i64>,
) -> Vec<Poll> {
    let mut rows: Vec<Poll> = polls
        .iter()
        .filter(|p| {
            p.round == round
                && p.candidate_key == candidate.key()
                && (geo == "ALL" || p.geo == geo)
        })
        .cloned()
        .collect();

    if let Some(days) = range_days {
        if let Some(max_day) = rows.iter().map(|p| p.day).max() {
            let min_day = max_day - days;
            rows.retain(|p| p.day >= min_day);
        }
    }
    rows.sort_by_key(|p| p.day);
    rows
}

pub fn available_geos(polls: &[Poll]) -> Vec<String> {
    let mut geos: Vec<String> = polls.iter().map(|p| p.geo.clone()).collect();
    geos.sort();
    geos.dedup();
    geos
}

pub fn parse_day(value: &str) -> Option<i64> {
    let s = value.get(..10)?;
    if s.len() != 10 || s.as_bytes()[4] != b'-' || s.as_bytes()[7] != b'-' {
        return None;
    }
    let y: i64 = s[0..4].parse().ok()?;
    let m: i64 = s[5..7].parse().ok()?;
    let d: i64 = s[8..10].parse().ok()?;
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }

    let y = y - i64::from(m <= 2);
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = m + if m > 2 { -3 } else { 9 };
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146097 + doe - 719468)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_iso_day() {
        assert_eq!(parse_day("1970-01-01"), Some(0));
        assert_eq!(parse_day("2026-09-21"), Some(20717));
    }

    #[test]
    fn parses_moe_values_like_production() {
        assert_eq!(parse_moe_value(&Some(serde_json::json!(2.4))), Some(2.4));
        assert_eq!(parse_moe_value(&Some(serde_json::json!("±2,4 pontos"))), Some(2.4));
        assert_eq!(parse_moe_value(&Some(serde_json::json!("margem 1.8 p.p."))), Some(1.8));
        assert_eq!(parse_moe_value(&Some(serde_json::json!("sem informação"))), None);
        assert_eq!(parse_moe_value(&None), None);
    }

    #[test]
    fn merge_promotes_unique_extra_and_deduplicates_candidates() {
        let base = RawPoll {
            institute: "Nexus/BTG".into(),
            fieldwork_start: Some("2026-09-04".into()),
            fieldwork_end: "2026-09-07".into(),
            published_date: Some("2026-09-08".into()),
            scenario: "estimulada 1º turno".into(),
            candidates: vec![CandidateResult { name: "Lula".into(), pct: 39.0 }],
            n: Some(2002.0),
            margin_of_error: Some(serde_json::json!("±2,0 pp")),
            source_url: "base".into(),
            methodology_note: Some("TSE BR-06790/2026.".into()),
            verified: Some(true),
            tse_registration: Some("BR-06790/2026".into()),
            tse_protocol: None,
            geo: Some("BR".into()),
        };
        let extra = RawPoll {
            candidates: vec![
                CandidateResult { name: "Lula".into(), pct: 39.0 },
                CandidateResult { name: "Flávio Bolsonaro".into(), pct: 35.0 },
            ],
            source_url: "extra".into(),
            ..base.clone()
        };
        let merged = merge_raw_polls(vec![base], vec![extra]);
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].candidates.len(), 2);
        assert_eq!(merged[0].source_url, "base");
    }

    #[test]
    fn merge_accepts_a_unique_verified_extra_with_canonical_identity() {
        let extra = RawPoll {
            institute: "Indexa".into(),
            fieldwork_start: Some("2026-09-10".into()),
            fieldwork_end: "2026-09-13".into(),
            published_date: Some("2026-09-15".into()),
            scenario: "2º turno Lula x Flávio Bolsonaro".into(),
            candidates: vec![
                CandidateResult { name: "Lula".into(), pct: 43.0 },
                CandidateResult { name: "Flávio Bolsonaro".into(), pct: 42.0 },
            ],
            n: Some(1000.0),
            margin_of_error: None,
            source_url: "extra".into(),
            methodology_note: Some("TSE BR-03482/2026.".into()),
            verified: Some(true),
            tse_registration: Some("BR-03482/2026".into()),
            tse_protocol: None,
            geo: Some("BR".into()),
        };
        let merged = merge_raw_polls(Vec::new(), vec![extra]);
        assert_eq!(merged.len(), 1);
        assert_eq!(
            canonical_poll_key(&identity_fields(&merged[0])),
            "tse|BR-03482/2026|2º turno lula x flavio bolsonaro|BR"
        );
    }

    #[test]
    fn shared_identity_aliases_are_used() {
        assert_eq!(candidate_key("Luiz Inácio Lula da Silva"), "lula");
        assert_eq!(candidate_key("Flávio Bolsonaro"), "flavio");
        assert!(candidate_key("Pablo Marçal").is_empty());
        assert_eq!(normalize_geo(Some("mg")), "MG");
    }

    #[test]
    fn rejects_unknown_candidate() {
        assert!(candidate_key("unknown person").is_empty());
    }
}
