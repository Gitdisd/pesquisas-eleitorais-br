use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
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

pub fn candidate_key(value: &str) -> String {
    let n = fold(value).to_ascii_lowercase().trim().to_string();
    if ["pablo marcal", "marcal", "pablo"].iter().any(|s| n == *s || n.contains(s)) {
        return String::new();
    }

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
        ("clariana barao", "clariana"), ("clariana", "clariana"),
        ("wilson grassi", "grassi"), ("veterinario wilson grassi", "grassi"), ("grassi", "grassi"),
        ("branco/nulo", "branco_nulo"), ("brancos ou nulos", "branco_nulo"),
        ("ninguem/branco/nulo", "branco_nulo"), ("branco/nulo/nenhum", "branco_nulo"),
        ("branco/nulo/nao sabe", "branco_nulo"), ("outros/branco/nulo/nao sabe", "branco_nulo"),
    ];

    aliases.iter()
        .filter_map(|(alias, key)| {
            if n == *alias || n.contains(alias) || alias.contains(&n) {
                Some((*key, alias.len()))
            } else {
                None
            }
        })
        .max_by_key(|(_, len)| *len)
        .map(|(key, _)| key.to_string())
        .unwrap_or_default()
}

pub fn is_first_round(scenario: &str) -> bool {
    let n = fold(scenario).to_ascii_lowercase();
    n.contains("1 turno") || n.contains("primeiro turno") || n.contains("estimulad")
}

pub fn is_second_round(scenario: &str) -> bool {
    let n = fold(scenario).to_ascii_lowercase();
    n.contains("2 turno") || n.contains("segundo turno")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_marcal() {
        assert!(candidate_key("Pablo Marçal").is_empty());
    }

    #[test]
    fn maps_aliases_and_prefers_longer_match() {
        assert_eq!(candidate_key("Luiz Inácio Lula da Silva"), "lula");
        assert_eq!(candidate_key("Escritor Augusto Cury"), "cury");
        assert_eq!(candidate_key("Ninguém/Branco/Nulo"), "branco_nulo");
    }
}
