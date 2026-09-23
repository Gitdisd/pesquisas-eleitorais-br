use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[allow(non_snake_case)]
pub struct IdentityFields {
    pub institute: String,
    pub fieldwork_start: Option<String>,
    pub fieldwork_end: Option<String>,
    pub published_date: Option<String>,
    pub scenario: String,
    pub geo: Option<String>,
    pub tse_registration: Option<String>,
    pub tse_protocol: Option<String>,
    pub tseProtocol: Option<String>,
    pub tse: Option<String>,
    pub methodology_note: Option<String>,
    pub coverage_dates: Vec<String>,
}

fn fold(value: &str) -> String {
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

pub fn normalize_identity_text(value: &str) -> String {
    let folded = fold(value);
    folded.split_whitespace().collect::<Vec<_>>().join(" ").to_ascii_lowercase()
}

pub fn normalize_institute(value: &str) -> String {
    let raw = normalize_identity_text(value);
    let raw = raw.split('/').map(str::trim).collect::<Vec<_>>().join("/");
    match raw.as_str() {
        "genial/quaest" | "quaest/genial" => "quaest".into(),
        "btg/nexus" | "nexus/btg" => "nexus".into(),
        "cnt/mda" | "mda/cnt" => "mda".into(),
        "meio/ideia" | "ideia/meio" => "ideia".into(),
        "poderdata/aya" | "poder data/aya" => "poderdata".into(),
        _ if raw.contains("datafolha") => "datafolha".into(),
        _ => raw,
    }
}

pub fn normalize_protocol(value: &str) -> Option<String> {
    let normalized = value
        .replace(' ', " ")
        .replace(['–', '—', '−'], "-");
    let bytes = normalized.as_bytes();

    for i in 0..bytes.len().saturating_sub(1) {
        if !((bytes[i] == b'B' || bytes[i] == b'b')
            && (bytes[i + 1] == b'R' || bytes[i + 1] == b'r')) {
            continue;
        }

        let mut j = i + 2;
        while j < bytes.len() && bytes[j].is_ascii_whitespace() { j += 1; }
        if j < bytes.len() && bytes[j] == b'-' { j += 1; }
        while j < bytes.len() && bytes[j].is_ascii_whitespace() { j += 1; }

        let start = j;
        while j < bytes.len() && bytes[j].is_ascii_digit() { j += 1; }
        let digits_len = j - start;
        if (8..=10).contains(&digits_len) {
            let run = &normalized[start..j];
            if run.ends_with("2026") {
                let code_len = run.len() - 4;
                if (4..=6).contains(&code_len) {
                    return Some(format!("BR-{}/2026", &run[..code_len]));
                }
            }
        }

        let code_start = start;
        let mut code_end = j;
        if !(4..=6).contains(&(code_end - code_start)) {
            code_end = code_start + 6.min(j - code_start);
        }
        for split in (4..=6).rev() {
            if code_start + split > j { continue; }
            let mut k = code_start + split;
            while k < bytes.len() && bytes[k].is_ascii_whitespace() { k += 1; }
            if k < bytes.len() && bytes[k] == b'/' {
                k += 1;
                while k < bytes.len() && bytes[k].is_ascii_whitespace() { k += 1; }
            }
            if normalized.get(k..k + 4) == Some("2026") {
                return Some(format!("BR-{}/2026", &normalized[code_start..code_start + split]));
            }
        }

        let _ = &mut code_end;
    }

    None
}

pub fn tse_protocol_of(row: &IdentityFields) -> Option<String> {
    [
        row.tse_registration.as_deref(),
        row.tse_protocol.as_deref(),
        row.tseProtocol.as_deref(),
        row.tse.as_deref(),
    ]
    .into_iter()
    .flatten()
    .find_map(normalize_protocol)
}

pub fn normalize_geo(value: Option<&str>) -> String {
    let geo = value.unwrap_or("BR").trim().to_ascii_uppercase();
    if geo.is_empty() { "BR".into() } else { geo }
}

pub fn fallback_poll_key(row: &IdentityFields) -> String {
    format!(
        "fallback|{}|{}|{}|{}|{}",
        normalize_institute(&row.institute),
        row.fieldwork_start.as_deref().unwrap_or(""),
        row.fieldwork_end.as_deref().unwrap_or(""),
        normalize_identity_text(&row.scenario),
        normalize_geo(row.geo.as_deref()),
    )
}

pub fn canonical_poll_key(row: &IdentityFields) -> String {
    if let Some(protocol) = tse_protocol_of(row) {
        format!(
            "tse|{}|{}|{}",
            protocol,
            normalize_identity_text(&row.scenario),
            normalize_geo(row.geo.as_deref()),
        )
    } else {
        fallback_poll_key(row)
    }
}

pub fn identity_match_keys(row: &IdentityFields) -> Vec<String> {
    let canonical = canonical_poll_key(row);
    let fallback = fallback_poll_key(row);
    if canonical == fallback { vec![canonical] } else { vec![canonical, fallback] }
}

pub fn coverage_dates(row: &IdentityFields) -> Vec<String> {
    let mut dates = row.coverage_dates
        .iter()
        .filter(|d| is_iso_date(d))
        .cloned()
        .collect::<Vec<_>>();
    if let Some(published) = row.published_date.as_deref() {
        if is_iso_date(published) { dates.push(published.to_string()); }
    }
    dates.sort();
    dates.dedup();
    dates
}

fn is_iso_date(value: &str) -> bool {
    value.len() == 10
        && value.as_bytes()[4] == b'-'
        && value.as_bytes()[7] == b'-'
        && value.as_bytes().iter().enumerate().all(|(i, b)| {
            i == 4 || i == 7 || b.is_ascii_digit()
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_identity_text_and_institute() {
        assert_eq!(normalize_identity_text("  Genial / Quaest  "), "genial / quaest");
        assert_eq!(normalize_institute("Genial / Quaest"), "quaest");
        assert_eq!(normalize_institute("Poder Data / Aya"), "poderdata");
    }

    #[test]
    fn parses_protocol_forms() {
        assert_eq!(normalize_protocol("BR-06902/2026").as_deref(), Some("BR-06902/2026"));
        assert_eq!(normalize_protocol("br 06902 2026").as_deref(), Some("BR-06902/2026"));
        assert_eq!(normalize_protocol("BR069022026").as_deref(), Some("BR-06902/2026"));
    }

    #[test]
    fn canonical_key_prefers_protocol() {
        let row = IdentityFields {
            institute: "CNT/MDA".into(),
            fieldwork_start: Some("2026-09-09".into()),
            fieldwork_end: Some("2026-09-13".into()),
            published_date: Some("2026-09-15".into()),
            scenario: "1º turno".into(),
            geo: Some("br".into()),
            tse_registration: Some("BR-06902/2026".into()),
            ..Default::default()
        };
        assert_eq!(canonical_poll_key(&row), "tse|BR-06902/2026|1º turno|BR");
    }

    #[test]
    fn coverage_dates_merge_and_deduplicate() {
        let row = IdentityFields {
            published_date: Some("2026-09-15".into()),
            coverage_dates: vec!["2026-09-13".into(), "2026-09-13".into(), "bad".into()],
            ..Default::default()
        };
        assert_eq!(coverage_dates(&row), vec!["2026-09-13", "2026-09-15"]);
    }
}
