use gloo_net::http::Request;
use serde::Deserialize;

const DATA_URL: &str = "data/polls.json";

#[derive(Clone, Debug, Deserialize)]
pub struct CandidateResult {
    pub name: String,
    pub pct: f64,
}

#[derive(Clone, Debug, Deserialize)]
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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Candidate {
    Lula,
    Flavio,
    Cury,
    Renan,
    Caiado,
    Zema,
    Samara,
    Hertz,
    Edmilson,
    Rui,
    Clariana,
    Grassi,
    BrancoNulo,
}

impl Candidate {
    pub fn key(self) -> &'static str {
        match self {
            Self::Lula => "lula",
            Self::Flavio => "flavio",
            Self::Cury => "cury",
            Self::Renan => "renan",
            Self::Caiado => "caiado",
            Self::Zema => "zema",
            Self::Samara => "samara",
            Self::Hertz => "hertz",
            Self::Edmilson => "edmilson",
            Self::Rui => "rui",
            Self::Clariana => "clariana",
            Self::Grassi => "grassi",
            Self::BrancoNulo => "branco_nulo",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Lula => "Lula",
            Self::Flavio => "Flávio Bolsonaro",
            Self::Cury => "Augusto Cury",
            Self::Renan => "Renan Santos",
            Self::Caiado => "Ronaldo Caiado",
            Self::Zema => "Romeu Zema",
            Self::Samara => "Samara Martins",
            Self::Hertz => "Hertz Dias",
            Self::Edmilson => "Edmilson Costa",
            Self::Rui => "Rui Costa Pimenta",
            Self::Clariana => "Clariana Barão",
            Self::Grassi => "Wilson Grassi",
            Self::BrancoNulo => "Brancos ou nulos",
        }
    }

    pub fn all() -> &'static [Candidate] {
        &[
            Self::Lula, Self::Flavio, Self::Cury, Self::Renan, Self::Caiado, Self::Zema,
            Self::Samara, Self::Hertz, Self::Edmilson, Self::Rui, Self::Clariana,
            Self::Grassi, Self::BrancoNulo,
        ]
    }
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
                id: format!("{row_index}:{geo}:{}:{key}", row.fieldwork_end, row.institute),
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

    out.sort_by(|a, b| a.day.cmp(&b.day).then_with(|| a.institute.cmp(&b.institute)).then_with(|| a.candidate_key.cmp(&b.candidate_key)));
    Ok(out)
}

pub fn filter_polls(polls: &[Poll], candidate: Candidate, round: u8, geo: &str, range_days: Option<i64>) -> Vec<Poll> {
    let mut rows: Vec<Poll> = polls.iter()
        .filter(|p| p.round == round && p.candidate_key == candidate.key() && (geo == "ALL" || p.geo == geo))
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

    // Howard Hinnant proleptic-Gregorian civil-date conversion.
    let y = y - i64::from(m <= 2);
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = m + if m > 2 { -3 } else { 9 };
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146097 + doe - 719468)
}

fn normalize_geo(value: Option<&str>) -> String {
    let value = value.unwrap_or("BR").trim();
    if value.is_empty() { "BR".to_string() } else { value.to_ascii_uppercase() }
}

fn ascii_fold(value: &str) -> String {
    value.chars().map(|c| match c {
        'á'|'à'|'ã'|'â'|'ä'|'Á'|'À'|'Ã'|'Â'|'Ä' => 'a',
        'é'|'è'|'ê'|'ë'|'É'|'È'|'Ê'|'Ë' => 'e',
        'í'|'ì'|'î'|'ï'|'Í'|'Ì'|'Î'|'Ï' => 'i',
        'ó'|'ò'|'õ'|'ô'|'ö'|'Ó'|'Ò'|'Õ'|'Ô'|'Ö' => 'o',
        'ú'|'ù'|'û'|'ü'|'Ú'|'Ù'|'Û'|'Ü' => 'u',
        'ç'|'Ç' => 'c',
        _ => c,
    }).collect()
}

pub fn candidate_key(value: &str) -> String {
    let n = ascii_fold(value).to_ascii_lowercase();
    let n = n.trim();

    let aliases: &[(&str, &str)] = &[
        ("luiz inacio lula da silva", "lula"), ("lula", "lula"),
        ("flavio bolsonaro", "flavio"), ("flavio", "flavio"),
        ("augusto cury", "cury"), ("escritor augusto cury", "cury"), ("cury", "cury"),
        ("renan santos", "renan"), ("renan", "renan"),
        ("ronaldo caiado", "caiado"), ("caiado", "caiado"),
        ("romeu zema", "zema"), ("zema", "zema"),
        ("samara martins", "samara"), ("samara", "samara"),
        ("hertz dias", "hertz"), ("hertz", "hertz"),
        ("edmilson costa", "edmilson"), ("edmilson dias", "edmilson"), ("edmilson", "edmilson"),
        ("rui costa pimenta", "rui"), ("rui costa", "rui"), ("pimenta", "rui"),
        ("clariana barao", "clariana"), ("clariana barão", "clariana"), ("clariana", "clariana"),
        ("wilson grassi", "grassi"), ("veterinario wilson grassi", "grassi"), ("grassi", "grassi"),
        ("branco/nulo", "branco_nulo"), ("brancos ou nulos", "branco_nulo"),
        ("ninguem/branco/nulo", "branco_nulo"), ("branco/nulo/nenhum", "branco_nulo"),
        ("branco/nulo/nao sabe", "branco_nulo"), ("outros/branco/nulo/nao sabe", "branco_nulo"),
    ];

    aliases.iter().find_map(|(alias, key)| {
        if n == *alias || n.contains(alias) || alias.contains(n) { Some((*key).to_string()) } else { None }
    }).unwrap_or_default()
}

fn is_first_round(value: &str) -> bool {
    let n = ascii_fold(value).to_ascii_lowercase();
    n.contains("1 turno") || n.contains("1º turno") || n.contains("primeiro turno") || n.contains("estimulad")
}

fn is_second_round(value: &str) -> bool {
    let n = ascii_fold(value).to_ascii_lowercase();
    n.contains("2 turno") || n.contains("2º turno") || n.contains("segundo turno")
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
    fn maps_current_candidate_aliases() {
        assert_eq!(candidate_key("Luiz Inácio Lula da Silva"), "lula");
        assert_eq!(candidate_key("Flávio Bolsonaro"), "flavio");
        assert_eq!(candidate_key("Ninguém/Branco/Nulo"), "branco_nulo");
    }

    #[test]
    fn rejects_unknown_candidate() {
        assert!(candidate_key("Pablo Marçal").is_empty());
    }
}
