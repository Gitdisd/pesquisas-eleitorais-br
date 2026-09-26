use dioxus::prelude::*;
use std::collections::BTreeMap;

use crate::data::Poll;
use crate::ui::{scroll_to_id, Language};

#[derive(Clone, Copy, PartialEq, Eq)]
enum RegionalRound {
    First,
    Second,
}

#[derive(Clone)]
struct RegionalTablePoll {
    rows: Vec<Poll>,
}

#[component]
pub fn RegionalPanel(polls: Vec<Poll>, language: Language) -> Element {
    let mut round = use_signal(|| RegionalRound::First);
    let mut selected_geos = use_signal(Vec::<String>::new);
    let geos = {
        let mut values = polls.iter().map(|poll| poll.geo.clone()).collect::<Vec<_>>();
        values.sort();
        values.dedup();
        values
    };
    let selected = selected_geos();
    let all_geos = geos.clone();
    let all_selected = selected.is_empty() || geos.iter().all(|geo| selected.iter().any(|item| item == geo));
    let round_value = if matches!(round(), RegionalRound::First) { 1 } else { 2 };

    let filtered: Vec<Poll> = polls.iter()
        .filter(|poll| poll.round == round_value)
        .filter(|poll| selected.is_empty() || selected.iter().any(|geo| geo == &poll.geo))
        .cloned()
        .collect();

    let table_rows = group_rows(&filtered);
    let title = if matches!(language, Language::En) {
        "All sources (national + states)"
    } else {
        "Todas as fontes (nacional + estados)"
    };

    rsx! {
        section { class: "panel regional-panel", id: "allSourcesPanel",
            p { class: "chapter-kicker", "Capítulo 2" }
            h2 { "{title}" }
            p { class: "hint",
                if matches!(language, Language::En) {
                    "Separate from the national aggregate above. Geography chips filter which published sources are shown; state data is not silently treated as Brazil."
                } else {
                    "Separado do agregado nacional acima. Os chips de geografia filtram as fontes publicadas; dados estaduais não são tratados como Brasil silenciosamente."
                }
            }

            div { class: "controls controls-primary",
                div { class: "seg", role: "group", "aria-label": "Turno com estados",
                    button {
                        class: if matches!(round(), RegionalRound::First) { "active" } else { "" },
                        onclick: move |_| round.set(RegionalRound::First),
                        if matches!(language, Language::En) { "1st round" } else { "1º turno" }
                    }
                    button {
                        class: if matches!(round(), RegionalRound::Second) { "active" } else { "" },
                        onclick: move |_| round.set(RegionalRound::Second),
                        if matches!(language, Language::En) { "2nd round" } else { "2º turno" }
                    }
                }
                button {
                    class: if all_selected { "chip on" } else { "chip" },
                    onclick: move |_| selected_geos.set(Vec::new()),
                    if matches!(language, Language::En) { "All geographies" } else { "Todas as geografias" }
                }
                for geo in geos.iter().cloned() {
                    button {
                        class: if selected.is_empty() || selected.iter().any(|value| value == &geo) { "chip on" } else { "chip" },
                        "aria-pressed": "{selected.is_empty() || selected.iter().any(|value| value == &geo)}",
                        onclick: move |_| {
                            let geo_name = geo.clone();
                            let all_geos = all_geos.clone();
                                let mut current = selected_geos();
                                if current.is_empty() {
                                    current = all_geos.iter().filter(|value| *value != &geo_name).cloned().collect();
                                } else if current.iter().any(|value| value == &geo_name) {
                                    if current.len() > 1 {
                                        current.retain(|value| value != &geo_name);
                                    }
                                } else {
                                    current.push(geo_name.clone());
                                    current.sort();
                                }
                                selected_geos.set(current);
                        },
                        {if geo == "BR" { "Nacional" } else { geo.as_str() }}
                    }
                }
            }

            div { class: "regional-chart-summary",
                span { class: "muted",
                    if matches!(language, Language::En) {
                        "{filtered.len()} candidate observations across {geos.len()} geographies"
                    } else {
                        "{filtered.len()} observações de candidatos em {geos.len()} geografias"
                    }
                }
                button {
                    class: "ui-btn",
                    onclick: move |_| scroll_to_id("allSourcesPanel"),
                    if matches!(language, Language::En) { "Focus" } else { "Focar" }
                }
            }

            {regional_chart(&filtered, language)}

            h3 { class: "chart-title regional-table-title",
                if matches!(language, Language::En) { "Table — all sources" } else { "Tabela — todas as fontes" }
            }
            div { class: "table-wrap",
                table { class: "polls",
                    thead { tr {
                        th { if matches!(language, Language::En) { "Fieldwork" } else { "Campo" } }
                        th { if matches!(language, Language::En) { "Pollster" } else { "Instituto" } }
                        th { if matches!(language, Language::En) { "Geo" } else { "Geo" } }
                        th { if matches!(language, Language::En) { "Published" } else { "Publicação" } }
                        th { class: "num", "N" }
                        th { "Margem" }
                        th { "TSE" }
                        for candidate in display_candidates(round_value) {
                            th { class: "num", "{candidate.label()}" }
                        }
                    }}
                    tbody {
                        for row in table_rows.iter().take(120) {
                            if let Some(first) = row.rows.first() {
                                tr {
                                    td { "{format_date(&first.fieldwork_end)}" }
                                    td { "{first.institute}" }
                                    td { "{first.geo}" }
                                    td { {first.published_date.as_deref().map(format_date).unwrap_or_else(|| "—".to_string())} }
                                    td { class: "num", "{first.n:.0}" }
                                    td { class: "num", {first.moe.map(|v| format!("±{v:.2}")).unwrap_or_else(|| "—".to_string())} }
                                    td { {first.tse_registration.as_deref().unwrap_or("—")} }
                                    for candidate in display_candidates(round_value) {
                                        td { class: "num",
                                            {row.rows.iter()
                                                .find(|poll| poll.candidate_key == candidate.key())
                                                .map(|poll| format!("{:.2}%", poll.value).replace('.', ","))
                                                .unwrap_or_else(|| "—".to_string())}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

fn display_candidates(round: u8) -> Vec<crate::data::Candidate> {
    if round == 2 {
        vec![
            crate::data::Candidate::Lula,
            crate::data::Candidate::Flavio,
            crate::data::Candidate::BrancoNulo,
        ]
    } else {
        crate::data::Candidate::all().to_vec()
    }
}

fn group_rows(rows: &[Poll]) -> Vec<RegionalTablePoll> {
    let mut grouped = BTreeMap::<String, Vec<Poll>>::new();
    for row in rows {
        grouped.entry(row.id.clone()).or_default().push(row.clone());
    }
    let mut out: Vec<RegionalTablePoll> = grouped.into_values()
        .map(|mut rows| {
            rows.sort_by(|a, b| a.candidate_key.cmp(&b.candidate_key));
            RegionalTablePoll { rows }
        })
        .collect();
    out.sort_by(|a, b| {
        let ad = a.rows.first().map(|row| row.day).unwrap_or(i64::MIN);
        let bd = b.rows.first().map(|row| row.day).unwrap_or(i64::MIN);
        bd.cmp(&ad)
    });
    out
}

fn regional_chart(rows: &[Poll], language: Language) -> Element {
    const WIDTH: f64 = 1100.0;
    const HEIGHT: f64 = 420.0;
    const LEFT: f64 = 58.0;
    const RIGHT: f64 = 24.0;
    const TOP: f64 = 18.0;
    const BOTTOM: f64 = 45.0;
    let min_day = rows.iter().map(|poll| poll.day).min().unwrap_or(0) as f64;
    let max_day = rows.iter().map(|poll| poll.day).max().unwrap_or(1) as f64;
    let max_day = max_day.max(min_day + 1.0);
    let min_y = rows.iter().map(|poll| poll.value).fold(f64::INFINITY, f64::min).min(0.0);
    let max_y = rows.iter().map(|poll| poll.value).fold(f64::NEG_INFINITY, f64::max).max(50.0);
    let y_pad = ((max_y - min_y).max(10.0) * 0.08).max(2.0);
    let low = (min_y - y_pad).max(0.0);
    let high = (max_y + y_pad).min(100.0);
    let x = |day: i64| LEFT + ((day as f64 - min_day) / (max_day - min_day)) * (WIDTH - LEFT - RIGHT);
    let y = |value: f64| TOP + (1.0 - (value - low) / (high - low).max(1.0)) * (HEIGHT - TOP - BOTTOM);

    let candidates = if rows.iter().any(|poll| poll.round == 2) {
        display_candidates(2)
    } else {
        display_candidates(1)
    };
    let all_geos = geos.clone();
    let series = candidates.iter().copied().map(|candidate| {
        let candidate_rows = rows.iter()
            .filter(|poll| poll.candidate_key == candidate.key())
            .cloned()
            .collect::<Vec<_>>();
        let trend = crate::chart::trend_for_model(&candidate_rows, 14.0, 1);
        let path = trend.iter()
            .map(|point| format!("{:.2},{:.2}", x(point.day), y(point.value)))
            .collect::<Vec<_>>()
            .join(" ");
        RegionalSeries {
            rows: candidate_rows,
            path,
            color: regional_candidate_color(candidate),
        }
    }).collect::<Vec<_>>();

    rsx! {
        div { class: "chart-box",
            svg {
                class: "chart regional-chart",
                view_box: "0 0 1100 420",
                role: "img",
                "aria-label": if matches!(language, Language::En) {
                    "Regional polling chart with national and state sources"
                } else {
                    "Gráfico regional com fontes nacionais e estaduais"
                },
                width: "{WIDTH}",
                height: "{HEIGHT}",
                rect { x: "0", y: "0", width: "{WIDTH}", height: "{HEIGHT}", fill: "var(--chart-bg, #0d1117)" }

                for i in 0..=5 {
                    line {
                        class: "grid-line",
                        x1: "{LEFT}",
                        x2: "{WIDTH-RIGHT}",
                        y1: {format!("{:.2}", y(high - (i as f64 / 5.0) * (high - low)))},
                        y2: {format!("{:.2}", y(high - (i as f64 / 5.0) * (high - low)))}
                    }
                    text {
                        class: "axis-label",
                        x: "8",
                        y: {format!("{:.2}", y(high - (i as f64 / 5.0) * (high - low)) + 4.0)},
                        {format!("{:.0}%", high - (i as f64 / 5.0) * (high - low))}
                    }
                }
                for series in series.iter() {
                    if !series.path.is_empty() {
                        polyline { class: "series-line", points: "{series.path}", style: "--series: {series.color};" }
                    }
                    for poll in series.rows.iter().take(200) {
                        circle {
                            class: "poll-point",
                            cx: {format!("{:.2}", x(poll.day))},
                            cy: {format!("{:.2}", y(poll.value))},
                            r: "3.2",
                            style: "fill: var(--surface); stroke: {series.color};",
                        }
                    }
                }
            }
        }
    }
}

struct RegionalSeries {
    rows: Vec<Poll>,
    path: String,
    color: &'static str,
}

fn regional_candidate_color(candidate: crate::data::Candidate) -> &'static str {
    match candidate {
        crate::data::Candidate::Lula => "#c62828",
        crate::data::Candidate::Flavio => "#009c3b",
        crate::data::Candidate::Cury => "#b45309",
        crate::data::Candidate::Renan => "#6d28d9",
        crate::data::Candidate::Caiado => "#4d7c0f",
        crate::data::Candidate::Zema => "#ea580c",
        crate::data::Candidate::Samara => "#0284c7",
        crate::data::Candidate::Hertz => "#475569",
        crate::data::Candidate::Edmilson => "#9f1239",
        crate::data::Candidate::Rui => "#0f766e",
        crate::data::Candidate::Clariana => "#7c3aed",
        crate::data::Candidate::Grassi => "#57534e",
        crate::data::Candidate::BrancoNulo => "#94a3b8",
    }
}

fn format_date(value: &str) -> String {
    let value = value.get(..10).unwrap_or(value);
    let parts = value.split('-').collect::<Vec<_>>();
    if parts.len() == 3 {
        format!("{}/{}/{}", parts[2], parts[1], parts[0])
    } else {
        value.to_string()
    }
}
