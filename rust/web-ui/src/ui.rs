use crate::data::Poll;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Language {
    PtBr,
    En,
}

impl Language {
    pub fn from_storage() -> Self {
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(value) = read_storage("pebr-language") {
                if value == "en" {
                    return Self::En;
                }
            }
        }
        Self::PtBr
    }

    pub fn code(self) -> &'static str {
        match self {
            Self::PtBr => "pt-BR",
            Self::En => "en",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Theme {
    Light,
    Dark,
    Pt,
    Pl,
    Missao,
    Psd,
    Novo,
    Avante,
    CrtAmber,
    CrtGreen,
}

impl Theme {
    pub fn from_storage() -> Self {
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(value) = read_storage("pebr-theme").or_else(|| read_storage("pebr-party-theme")) {
                return match value.as_str() {
                    "dark" => Self::Dark,
                    "party-pt" => Self::Pt,
                    "party-pl" => Self::Pl,
                    "party-missao" => Self::Missao,
                    "party-psd" => Self::Psd,
                    "party-novo" => Self::Novo,
                    "party-avante" => Self::Avante,
                    "crt-amber" => Self::CrtAmber,
                    "crt-green" => Self::CrtGreen,
                    _ => Self::Light,
                };
            }
        }
        Self::Dark
    }

    pub fn storage_key(self) -> &'static str {
        match self {
            Self::Light => "light",
            Self::Dark => "dark",
            Self::Pt => "party-pt",
            Self::Pl => "party-pl",
            Self::Missao => "party-missao",
            Self::Psd => "party-psd",
            Self::Novo => "party-novo",
            Self::Avante => "party-avante",
            Self::CrtAmber => "crt-amber",
            Self::CrtGreen => "crt-green",
        }
    }

    pub fn label(self, language: Language) -> &'static str {
        match self {
            Self::Light => match language {
                Language::PtBr => "Claro",
                Language::En => "Light",
            },
            Self::Dark => match language {
                Language::PtBr => "Escuro",
                Language::En => "Dark",
            },
            Self::Pt => "PT",
            Self::Pl => "PL",
            Self::Missao => "Missão",
            Self::Psd => "PSD",
            Self::Novo => "Novo",
            Self::Avante => "Avante",
            Self::CrtAmber => match language {
                Language::PtBr => "CRT âmbar",
                Language::En => "CRT amber",
            },
            Self::CrtGreen => match language {
                Language::PtBr => "CRT verde",
                Language::En => "CRT green",
            },
        }
    }

    pub fn is_party(self) -> bool {
        matches!(
            self,
            Self::Pt | Self::Pl | Self::Missao | Self::Psd | Self::Novo | Self::Avante
        )
    }
}

#[derive(Clone, PartialEq)]
pub struct UiState {
    pub language: Language,
    pub theme: Theme,
    /// Empty means "all institutes"; otherwise this is the explicit selected set.
    pub institutes: Vec<String>,
    pub table_query: String,
    pub hidden_candidates: Vec<String>,
    pub overlays: Vec<String>,
    pub status: Option<String>,
}

impl UiState {
    pub fn restored() -> Self {
        Self {
            language: Language::from_storage(),
            theme: Theme::from_storage(),
            institutes: restored_institutes(),
            table_query: String::new(),
            hidden_candidates: Vec::new(),
            overlays: restored_overlays(),
            status: None,
        }
    }

    pub fn institute_selected(&self, name: &str) -> bool {
        self.institutes.is_empty() || self.institutes.iter().any(|item| item == name)
    }

    pub fn theme_style(&self) -> String {
        theme_style(self.theme)
    }
}

pub fn t(language: Language, key: &str) -> &'static str {
    if matches!(language, Language::PtBr) {
        return match key {
            "dashboard" => "Painel de acompanhamento",
            "chart" => "Gráfico",
            "summary" => "Resumo",
            "methodology" => "Metodologia",
            "fieldwork" => "Campo",
            "publication" => "Publicação",
            "institute" => "Instituto",
            "geo" => "Geo",
            "scenario" => "Cenário",
            "value" => "Valor",
            "sample" => "N",
            "margin" => "Margem",
            "source" => "Fonte",
            "polls-shown" => "Pesquisas exibidas",
            "chapter" => "Capítulo 2",
            "all-sources" => "Todas as fontes (nacional + estados)",
            "refresh" => "Atualizar",

            "public-data" => "dados públicos",
            "overview" => "Visão geral do conjunto de pesquisas",
            "overview-copy" => "Um resumo rápido antes de entrar no gráfico e na tabela. Nada aqui altera os cálculos do site.",
            "open-chart" => "Abrir gráfico",
            "view-polls" => "Ver pesquisas",
            "published-polls" => "Pesquisas publicadas",
            "pollsters" => "Institutos",
            "latest-fieldwork" => "Campo mais recente",
            "fieldwork-end" => "fim de campo",
            "round-coverage" => "Cobertura por turno",
            "national-base" => "base nacional publicada",
            "loaded-data" => "presentes nos dados carregados",
            "first-round" => "1º turno",
            "second-round" => "2º turno",
            "round" => "Turno",
            "period" => "Período",
            "model" => "Modelo",
            "geography" => "Geografia",
            "all" => "Todas",
            "series" => "Série",
            "averaging-window" => "Janela da média",
            "custom" => "personalizado",
            "all-period" => "Tudo",
            "polls" => "Pesquisas exibidas",
            "table" => "Tabela de pesquisas",
            "search-table" => "Filtrar instituto, cenário ou campo…",
            "rows" => "linhas",
            "filters" => "Filtros por instituto",
            "filter-help" => "Use os chips para incluir ou excluir institutos do gráfico e da tabela.",
            "select-all" => "Todos",
            "share" => "Compartilhar",
            "copy-link" => "Link copiado",
            "export-csv" => "Exportar CSV",
            "export-json" => "Exportar JSON",
            "focus" => "Focar",
            "fullscreen" => "Tela cheia",
            "reset-view" => "Restaurar visualização",
            "language" => "Idioma",
            "themes" => "Temas",
            "default-theme" => "Padrão",
            "follow" => "Seguir",
            "transition-copy" => "Interface de transição: aplicação Rust/Dioxus + gráfico SVG customizado.",
            "no-chart-library" => "Sem biblioteca de gráficos",
            "loading" => "Carregando pesquisas…",
            "no-observations" => "Nenhuma observação disponível para este recorte.",
            "latest-shown" => "Última pesquisa exibida",
            "source-note" => "Pontos são pesquisas individuais; a linha usa o modelo selecionado. Data = fim de campo.",
            "table-sample" => "Amostra da tabela para inspeção do novo front-end.",
            "guide" => "Como usar",
            "guide-copy" => "selecione o turno, ajuste a janela da média, filtre institutos e toque em um ponto do gráfico para ler a pesquisa.",
            "static-footer" => "Site estático e sem fins partidários. Hospedagem via GitHub Pages.",
            "zoom-help" => "Zoom X/Y: roda do mouse, pinça ou arrastar. Fontes: TSE e institutos.",
            "exported-csv" => "CSV exportado",
            "exported-json" => "JSON exportado",
            "view-restored" => "Visualização restaurada",
            "sharing-unavailable" => "Compartilhamento por área de transferência indisponível",
            "full-screen-unavailable" => "Tela cheia indisponível neste navegador",
            _ => key,
        };
    }

    match key {
        "dashboard" => "Research dashboard",
        "chart" => "Chart",
        "summary" => "Summary",
        "methodology" => "Methodology",
        "fieldwork" => "Fieldwork",
        "publication" => "Publication",
        "institute" => "Pollster",
        "geo" => "Geo",
        "scenario" => "Scenario",
        "value" => "Value",
        "sample" => "N",
        "margin" => "Margin",
        "source" => "Source",
        "polls-shown" => "Displayed polls",
        "chapter" => "Chapter 2",
        "all-sources" => "All sources (national + states)",
        "refresh" => "Refresh",

        "public-data" => "public data",
        "overview" => "Polling dataset overview",
        "overview-copy" => "A quick overview before the chart and table. Nothing here changes the site’s calculations.",
        "open-chart" => "Open chart",
        "view-polls" => "View polls",
        "published-polls" => "Published polls",
        "pollsters" => "Pollsters",
        "latest-fieldwork" => "Latest fieldwork",
        "fieldwork-end" => "fieldwork end",
        "round-coverage" => "Coverage by round",
        "national-base" => "published national dataset",
        "loaded-data" => "included in the loaded data",
        "first-round" => "1st round",
        "second-round" => "2nd round",
        "round" => "Round",
        "period" => "Range",
        "model" => "Model",
        "geography" => "Geography",
        "all" => "All",
        "series" => "Series",
        "averaging-window" => "Averaging window",
        "custom" => "custom",
        "all-period" => "All",
        "polls" => "Displayed polls",
        "table" => "Poll results",
        "search-table" => "Search pollster, scenario, or fieldwork…",
        "rows" => "rows",
        "filters" => "Pollster filters",
        "filter-help" => "Use the chips to include or exclude pollsters from the chart and table.",
        "select-all" => "All",
        "share" => "Share",
        "copy-link" => "Link copied",
        "export-csv" => "Export CSV",
        "export-json" => "Export JSON",
        "focus" => "Focus",
        "fullscreen" => "Full screen",
        "reset-view" => "Reset view",
        "language" => "Language",
        "themes" => "Themes",
        "default-theme" => "Default",
        "follow" => "Follow",
        "transition-copy" => "Transition interface: Rust/Dioxus application + custom SVG chart.",
        "no-chart-library" => "No chart library",
        "loading" => "Loading polls…",
        "no-observations" => "No observations available for this view.",
        "latest-shown" => "Latest displayed poll",
        "source-note" => "Points are individual polls; the line uses the selected model. Date = fieldwork end.",
        "table-sample" => "Sample table for inspection of the new front end.",
        "guide" => "How to use",
        "guide-copy" => "select the round, adjust the averaging window, filter pollsters, and tap a chart point to inspect the poll.",
        "static-footer" => "Static, non-partisan site. Hosted on GitHub Pages.",
        "zoom-help" => "X/Y zoom: mouse wheel, pinch, or drag. Sources: TSE and polling institutes.",
        "exported-csv" => "CSV exported",
        "exported-json" => "JSON exported",
        "view-restored" => "View restored",
        "sharing-unavailable" => "Clipboard sharing is unavailable",
        "full-screen-unavailable" => "Full screen is unavailable in this browser",
        _ => key,
    }
}

pub fn theme_style(theme: Theme) -> String {
    let base = match theme {
        Theme::Light => (
            "#f4f6f8", "#ffffff", "#1a1d21", "#5c6570", "#d8dee6", "#2563eb",
            "#f8fafc", "#e8eefc", "#93b4f5", "#1e3a8a", "#1a1d21", "#ffffff",
            "#ffffff", "#d8dee6", "0 1px 3px rgba(0,0,0,.08)",
        ),
        Theme::Dark => (
            "#0f1216", "#1a1f26", "#e8eaed", "#a8b0ba", "#2c3440", "#6ea8fe",
            "#232a33", "#1e3a5f", "#3b6ea5", "#cfe3ff", "#e8eaed", "#0f1216",
            "#1a1f26", "#2c3440", "0 1px 3px rgba(0,0,0,.35)",
        ),
        Theme::Pt => (
            "#4a0b16", "#6b1020", "#fff8f6", "#f3c4c8", "#9a2030", "#ffffff",
            "#5a0e1a", "#c0122d", "#ffffff", "#ffffff", "#ffffff", "#6b1020",
            "linear-gradient(180deg,#c0122d 0%,#6b1020 72%)", "#ffffff", "none",
        ),
        Theme::Pl => (
            "#161636", "#22225a", "#ffe9a0", "#d4c07a", "#3c3c80", "#ffd200",
            "#1c1c48", "#30306c", "#ffd200", "#ffd200", "#ffd200", "#161636",
            "linear-gradient(180deg,#30306c 0%,#161636 80%)", "#ffd200", "none",
        ),
        Theme::Missao => (
            "#111111", "#1c1c1c", "#fcbe26", "#d7a31c", "#fcbe26", "#ffffff",
            "#191919", "#fcbe26", "#ffffff", "#111111", "#fcbe26", "#111111",
            "#000000", "#fcbe26", "none",
        ),
        Theme::Psd => (
            "#2a1600", "#3d2200", "#ffe4b0", "#e0b46a", "#ffa400", "#ffa400",
            "#321c00", "#ffa400", "#fff3d6", "#2a1600", "#ffa400", "#2a1600",
            "linear-gradient(180deg,#ffa400 0%,#3d2200 70%)", "#ffa400", "none",
        ),
        Theme::Novo => (
            "#1c0d04", "#2c1608", "#ffe8d6", "#f0b48a", "#ec671c", "#ec671c",
            "#241208", "#ec671c", "#ffd200", "#ffffff", "#ec671c", "#1c0d04",
            "linear-gradient(180deg,#ec671c 0%,#2c1608 78%)", "#ffd200", "none",
        ),
        Theme::Avante => (
            "#062022", "#0a3034", "#e8ffff", "#9ad4d8", "#2eabb1", "#2eabb1",
            "#083034", "#2eabb1", "#e8ffff", "#062022", "#2eabb1", "#062022",
            "linear-gradient(180deg,#2eabb1 0%,#0a3034 72%)", "#e8ffff", "none",
        ),
        Theme::CrtAmber => (
            "#140e04", "#1c1406", "#ffb000", "#c48420", "#8a5a10", "#ffd36a",
            "#221806", "#3a2808", "#ffb000", "#ffe7a8", "#ffb000", "#140e04",
            "#1c1406", "#8a5a10", "0 0 8px rgba(255,176,0,.35)",
        ),
        Theme::CrtGreen => (
            "#031208", "#06180c", "#3dff7a", "#1fa34d", "#0d5c2a", "#9affb8",
            "#04160a", "#083016", "#3dff7a", "#c8ffd8", "#3dff7a", "#031208",
            "#06180c", "#0d5c2a", "0 0 8px rgba(61,255,122,.32)",
        ),
    };

    format!(
        "--bg:{};--surface:{};--text:{};--muted:{};--border:{};--accent:{};\
         --chip-bg:{};--chip-on-bg:{};--chip-on-border:{};--chip-on-text:{};\
         --seg-active-bg:{};--seg-active-fg:{};--header-bg:{};--header-border:{};\
         --radius:{};--shadow:{};--crt-glow:var(--shadow);--scan:transparent;color:var(--text);",
        base.0, base.1, base.2, base.3, base.4, base.5,
        base.6, base.7, base.8, base.9, base.10, base.11, base.12, base.13,
        if theme.is_party() { "6px" } else { "12px" }, base.14,
    )
}

#[cfg(target_arch = "wasm32")]
fn read_storage(key: &str) -> Option<String> {
    web_sys::window()?
        .local_storage()
        .ok()
        .flatten()?
        .get_item(key)
        .ok()
        .flatten()
}

#[cfg(target_arch = "wasm32")]
fn write_storage(key: &str, value: &str) {
    if let Some(storage) = web_sys::window().and_then(|window| window.local_storage().ok().flatten()) {
        let _ = storage.set_item(key, value);
    }
}

pub fn persist_language(language: Language) {
    #[cfg(target_arch = "wasm32")]
    write_storage(
        "pebr-language",
        if matches!(language, Language::En) { "en" } else { "pt-BR" },
    );
}

pub fn persist_model(model: u8) {
    #[cfg(target_arch = "wasm32")]
    write_storage("pebr-model", &model.to_string());
}


pub fn persist_theme(theme: Theme) {
    #[cfg(target_arch = "wasm32")]
    {
        write_storage("pebr-theme", theme.storage_key());
        if theme.is_party() {
            write_storage("pebr-party-theme", theme.storage_key());
        } else {
            let _ = web_sys::window()
                .and_then(|window| window.local_storage().ok().flatten())
                .and_then(|storage| storage.remove_item("pebr-party-theme").ok());
        }
    }
}

#[cfg(target_arch = "wasm32")]
fn query_value(key: &str) -> Option<String> {
    let window = web_sys::window()?;
    let search = window.location().search().ok()?;
    let params = web_sys::UrlSearchParams::new_with_str(&search).ok()?;
    params.get(key)
}

pub fn initial_round() -> u8 {
    #[cfg(target_arch = "wasm32")]
    {
        if let Some(value) = query_value("round").and_then(|value| value.parse::<u8>().ok()) {
            if value == 1 || value == 2 {
                return value;
            }
        }
    }
    1
}

pub fn initial_range_days() -> Option<i64> {
    #[cfg(target_arch = "wasm32")]
    {
        if let Some(value) = query_value("range") {
            if value == "all" {
                return None;
            }
            if let Ok(days) = value.parse::<i64>() {
                if days > 0 {
                    return Some(days);
                }
            }
        }
    }
    Some(30)
}

pub fn initial_avg_window_days() -> i64 {
    #[cfg(target_arch = "wasm32")]
    {
        if let Some(value) = query_value("window") {
            if value.eq_ignore_ascii_case("ytd") {
                return 365;
            }
            if let Ok(days) = value.parse::<i64>() {
                if days > 0 {
                    return days;
                }
            }
        }
    }
    14
}

pub fn initial_projection() -> bool {
    #[cfg(target_arch = "wasm32")]
    if let Some(value) = query_value("projection") {
        return matches!(value.as_str(), "1" | "true" | "on");
    }
    false
}


pub fn initial_model() -> u8 {
    #[cfg(target_arch = "wasm32")]
    {
        if let Some(value) = query_value("model").and_then(|value| value.parse::<u8>().ok()) {
            if (1..=12).contains(&value) {
                return value;
            }
        }
        if let Some(value) = read_storage("pebr-model").and_then(|value| value.parse::<u8>().ok()) {
            if (1..=12).contains(&value) {
                return value;
            }
        }
    }
    1
}

fn restored_institutes() -> Vec<String> {
    #[cfg(target_arch = "wasm32")]
    if let Some(value) = query_value("institutes") {
        let items = value.split(',').map(str::trim).filter(|v| !v.is_empty()).map(ToString::to_string).collect::<Vec<_>>();
        if !items.is_empty() {
            return items;
        }
    }
    Vec::new()
}


fn restored_overlays() -> Vec<String> {
    #[cfg(target_arch = "wasm32")]
    if let Some(raw) = read_storage("pebr-overlays") {
        if let Ok(values) = serde_json::from_str::<std::collections::BTreeMap<String, bool>>(&raw) {
            return values.into_iter().filter_map(|(key, enabled)| enabled.then_some(key)).collect();
        }
    }
    Vec::new()
}

pub fn persist_overlays(overlays: &[String]) {
    #[cfg(target_arch = "wasm32")]
    {
        let values = overlays.iter().map(|key| (key.clone(), true)).collect::<std::collections::BTreeMap<_, _>>();
        if let Ok(raw) = serde_json::to_string(&values) {
            write_storage("pebr-overlays", &raw);
        }
    }
}

pub fn apply_document_chrome(language: Language) {
    #[cfg(target_arch = "wasm32")]
    {
        if let Some(document) = web_sys::window().and_then(|window| window.document()) {
            if let Some(root) = document.document_element() {
                let _ = root.set_attribute("lang", language.code());
            }
            document.set_title(match language {
                Language::PtBr => "Pesquisas Eleitorais BR — 2026",
                Language::En => "Brazilian Electoral Polls — 2026",
            });
            if let Ok(Some(node)) = document.query_selector("meta[name=\"description\"]") {
                let _ = node.set_attribute(
                    "content",
                    match language {
                        Language::PtBr => "Dados de pesquisas eleitorais brasileiras, metodologia, gráficos e resultados históricos.",
                        Language::En => "Brazilian electoral polling data, methodology, charts and historical results.",
                    },
                );
            }
        }
    }
}

pub fn reload_page() {
    #[cfg(target_arch = "wasm32")]
    {
        if let Some(window) = web_sys::window() {
            let _ = window.location().reload();
        }
    }
}

pub fn scroll_to_id(id: &str) {
    #[cfg(target_arch = "wasm32")]
    if let Some(element) = web_sys::window()
        .and_then(|window| window.document())
        .and_then(|document| document.get_element_by_id(id))
    {
        element.scroll_into_view();
    }
}

pub fn build_share_url(
    round: u8,
    range_days: Option<i64>,
    avg_window_days: i64,
    model: u8,
    projection: bool,
    candidate: &str,
    geo: &str,
    institutes: &[String],
) -> Option<String> {
    #[cfg(target_arch = "wasm32")]
    {
        let location = web_sys::window()?.location();
        let href = location.href().ok()?;
        let url = web_sys::Url::new(&href).ok()?;
        let params = url.search_params();
        params.set("round", &round.to_string());
        params.set(
            "range",
            &range_days
                .map(|value| value.to_string())
                .unwrap_or_else(|| "all".into()),
        );
        params.set("window", &avg_window_days.to_string());
        params.set("model", &model.to_string());
        params.set("projection", if projection { "1" } else { "0" });
        params.set("candidate", candidate);
        params.set("geo", geo);
        if institutes.is_empty() {
            params.delete("institutes");
        } else {
            params.set("institutes", &institutes.join(","));
        }
        url.set_hash("");
        Some(url.href())
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = (round, range_days, avg_window_days, model, projection, candidate, geo, institutes);
        None
    }
}

pub fn copy_text(text: &str) -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        if let Some(clipboard) = web_sys::window().map(|window| window.navigator().clipboard()) {
            let _ = clipboard.write_text(text);
            return true;
        }
    }
    false
}

pub fn download_text(filename: &str, mime: &str, text: &str) -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        use wasm_bindgen::JsCast;
        let encoded = js_sys::encode_uri_component(text).as_string().unwrap_or_default();
        let href = format!("data:{mime},{encoded}");
        let Some(document) = web_sys::window().and_then(|window| window.document()) else { return false; };
        let Ok(node) = document.create_element("a") else { return false; };
        let Ok(anchor) = node.dyn_into::<web_sys::HtmlAnchorElement>() else { return false; };
        let _ = anchor.set_attribute("href", &href);
        let _ = anchor.set_attribute("download", filename);
        anchor.click();
        true
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = (filename, mime, text);
        false
    }
}

pub fn fullscreen(app_id: &str) -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        let Some(document) = web_sys::window().and_then(|window| window.document()) else { return false; };
        if document.fullscreen_element().is_some() {
            return document.exit_fullscreen().is_ok();
        }
        let Some(element) = document.get_element_by_id(app_id) else { return false; };
        element.request_fullscreen().is_ok()
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = app_id;
        false
    }
}

fn csv_cell(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn date_stamp() -> String {
    #[cfg(target_arch = "wasm32")]
    {
        let date = js_sys::Date::new_0();
        return format!(
            "{:04}-{:02}-{:02}",
            date.get_full_year(),
            date.get_month() + 1,
            date.get_date()
        );
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        "export".to_string()
    }
}

pub fn csv_export(rows: &[Poll]) -> bool {
    let mut grouped = std::collections::BTreeMap::<String, Vec<&Poll>>::new();
    for row in rows {
        grouped.entry(row.id.clone()).or_default().push(row);
    }

    let candidates = polling_core::Candidate::all();
    let mut header = vec![
        "Fim de campo".to_string(),
        "Publicação".to_string(),
        "Instituto".to_string(),
        "Geo".to_string(),
        "Cenário".to_string(),
        "TSE".to_string(),
        "N".to_string(),
        "Margem".to_string(),
    ];
    for candidate in candidates.iter().copied() {
        header.push(candidate.label().to_string());
    }
    header.push("Fonte".to_string());

    let mut lines = vec![header.iter().map(|value| csv_cell(value)).collect::<Vec<_>>().join(";")];
    for group in grouped.values() {
        let Some(first) = group.first() else { continue; };
        let mut row = vec![
            csv_cell(&first.fieldwork_start.clone().unwrap_or_else(|| first.fieldwork_end.clone())),
            csv_cell(first.published_date.as_deref().unwrap_or("")),
            csv_cell(&first.institute),
            csv_cell(&first.geo),
            csv_cell(&first.scenario),
            csv_cell(first.tse_registration.as_deref().unwrap_or("")),
            csv_cell(&format!("{:.0}", first.n)),
            csv_cell(&first.moe.map(|v| format!("±{v:.2}")).unwrap_or_else(|| "—".into())),
        ];
        for candidate in candidates.iter().copied() {
            let value = group.iter()
                .find(|poll| poll.candidate_key == candidate.key())
                .map(|poll| format!("{:.2}", poll.value).replace('.', ","))
                .unwrap_or_else(|| "—".into());
            row.push(csv_cell(&value));
        }
        row.push(csv_cell(&first.source_url));
        lines.push(row.join(";"));
    }

    let csv = format!("\ufeff{}", lines.join("\n"));
    download_text(
        &format!("pesquisas-eleitorais-{}.csv", date_stamp()),
        "text/csv;charset=utf-8",
        &csv,
    )
}


pub fn json_export(
    rows: &[Poll],
    round: u8,
    range_days: Option<i64>,
    avg_window_days: i64,
    model: u8,
    candidate: &str,
    geo: &str,
) -> bool {
    let mut grouped = std::collections::BTreeMap::<String, Vec<&Poll>>::new();
    for row in rows {
        grouped.entry(row.id.clone()).or_default().push(row);
    }

    let polls = grouped.values().filter_map(|group| {
        let first = group.first()?;
        let candidates = group.iter()
            .map(|poll| serde_json::json!({
                "candidate": poll.candidate_key,
                "value": poll.value,
            }))
            .collect::<Vec<_>>();

        Some(serde_json::json!({
            "id": first.id,
            "fieldwork_start": first.fieldwork_start,
            "fieldwork_end": first.fieldwork_end,
            "published_date": first.published_date,
            "institute": first.institute,
            "geo": first.geo,
            "scenario": first.scenario,
            "tse_registration": first.tse_registration,
            "verified": first.verified,
            "n": first.n,
            "margin_of_error": first.moe,
            "source_url": first.source_url,
            "candidates": candidates,
        }))
    }).collect::<Vec<_>>();

    let payload = serde_json::json!({
        "schema_version": 2,
        "exported_at": date_stamp(),
        "source": "rust-dioxus",
        "view": {
            "round": round,
            "range_days": range_days,
            "averaging_window_days": avg_window_days,
            "model": model,
            "candidate": candidate,
            "geo": geo
        },
        "record_count": polls.len(),
        "polls": polls,
    });

    let Ok(text) = serde_json::to_string_pretty(&payload) else { return false; };
    download_text(
        &format!("pesquisas-eleitorais-{}.json", date_stamp()),
        "application/json;charset=utf-8",
        &text,
    )
}
