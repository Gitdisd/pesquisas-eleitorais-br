use gloo_net::http::Request;
use serde::Deserialize;

pub use polling_core::{
    candidate_key, is_first_round, is_second_round, normalize_geo, Candidate,
};

const DATA_URL: &str = "data/polls.json";

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

#[derive(Clone, Debug)]
#[allow(dead_code)]
pub struct Poll {
    pub id: String,
    pub institute: String,
    pub fieldwork_end: String,
    pub published_date: Option<String>,
    pub scenario: String,
    pub n: f64,
    pub geo: String,
    pub source_url: String,
    pub candidate_key: String,
    pub value: f64,
    pub round: u8,
    pub day: i64,
}

pub async fn load_polls() -> Result<Vec<Poll>, String> {
    let payload = Request::get(DATA_URL)
        .send()
        .await
        .map_err(|err| format!("Falha ao buscar pesquisas: {err}"))?
        .json::<PollPayload>()
        .await
        .map_err(|err| format!("JSON inválido: {err}"))?;

    let rows = match payload {
        PollPayload::Rows(rows) => rows,
        PollPayload::Wrapped { polls } => polls,
    };

    let mut out = Vec::new();
    for (row_index, row) in rows.into_iter().enumerate() {
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

        for candidate in row.candidates {
            let key = candidate_key(&candidate.name);
            if key.is_empty() || !candidate.pct.is_finite() {
                continue;
            }
            out.push(Poll {
                id: format!("{row_index}:{geo}:{}:{}:{key}", row.fieldwork_end, row.institute),
                institute: row.institute.clone(),
                fieldwork_end: row.fieldwork_end.clone(),
                published_date: row.published_date.clone(),
                scenario: row.scenario.clone(),
                n: row.n.unwrap_or(800.0),
                geo: geo.clone(),
                source_url: row.source_url.clone(),
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
