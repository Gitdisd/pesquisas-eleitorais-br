use dioxus::prelude::*;
use crate::chart::{polyline_path, viewbox, weighted_trend, x_for, y_for, HEIGHT, LEFT, RIGHT, TOP, BOTTOM};
use crate::data::{available_geos, filter_polls, load_polls, Candidate, Poll};

const STYLE: &str = include_str!("../assets/style.css");

#[derive(Clone, Copy, PartialEq)]
struct ViewState {
    candidate: Candidate,
    round: u8,
    range_days: Option<i64>,
    geo_index: usize,
}

pub fn App() -> Element {
    let mut view = use_signal(|| ViewState {
        candidate: Candidate::Lula,
        round: 1,
        range_days: Some(30),
        geo_index: 0,
    });

    let polls = use_resource(|| async { load_polls().await });

    rsx! {
        style { "{STYLE}" }
        div { class: "app",
            header {
                div {
                    h1 { "Pesquisas Eleitorais BR — 2026" }
                    p { class: "muted", "Interface de transição: aplicação Rust/Dioxus + gráfico SVG customizado." }
                }
                div { class: "muted", "Sem biblioteca de gráficos" }
            }

            match polls.read().as_ref() {
                None => rsx! { section { class: "panel status", "Carregando pesquisas…" } },
                Some(Err(error)) => rsx! { section { class: "panel status", "{error}" } },
                Some(Ok(all)) => {
                    let state = view();
                    let geos = available_geos(all);
                    let all_index = geos.len();
                    let selected_geo = if state.geo_index == all_index {
                        "ALL".to_string()
                    } else {
                        geos.get(state.geo_index).cloned().unwrap_or_else(|| "BR".to_string())
                    };
                    let filtered = filter_polls(all, state.candidate, state.round, &selected_geo, state.range_days);
                    let trend = weighted_trend(&filtered);
                    let latest = filtered.last();
                    rsx! {
                        section { class: "panel",
                            div { class: "toolbar",
                                strong { "Turno" }
                                button {
                                    class: if state.round == 1 { "active" } else { "" },
                                    onclick: move |_| view.write().round = 1,
                                    "1º turno"
                                }
                                button {
                                    class: if state.round == 2 { "active" } else { "" },
                                    onclick: move |_| view.write().round = 2,
                                    "2º turno"
                                }
                            }
                            div { class: "toolbar",
                                strong { "Janela" }
                                for (label, days) in [(("14d", Some(14_i64))), (("30d", Some(30_i64))), (("90d", Some(90_i64))), (("Tudo", None))] {
                                    button {
                                        class: if state.range_days == days { "active" } else { "" },
                                        onclick: move |_| view.write().range_days = days,
                                        "{label}"
                                    }
                                }
                            }
                            div { class: "toolbar",
                                strong { "Geografia" }
                                button {
                                    class: if state.geo_index == all_index { "active" } else { "" },
                                    onclick: move |_| view.write().geo_index = all_index,
                                    "Todas"
                                }
                                for (index, geo) in geos.iter().enumerate() {
                                    button {
                                        class: if state.geo_index == index { "active" } else { "" },
                                        onclick: move |_| view.write().geo_index = index,
                                        "{geo}"
                                    }
                                }
                            }
                            div { class: "chips",
                                strong { "Série" }
                                for candidate in Candidate::all().iter().copied() {
                                    button {
                                        class: if state.candidate == candidate { "active" } else { "" },
                                        onclick: move |_| view.write().candidate = candidate,
                                        "{candidate.label()}"
                                    }
                                }
                            }
                        }

                        section { class: "panel",
                            h2 { "{state.candidate.label()} — {if state.round == 1 { "1º turno" } else { "2º turno" }}" }
                            p { class: "muted", "Pontos são pesquisas individuais; a linha é a média ponderada canônica. Data = fim de campo." }
                            div { class: "chart-wrap",
                                {chart_svg(&filtered, &trend)}
                            }
                            if let Some(last) = latest {
                                p { class: "muted", "Última pesquisa exibida: {format_date(&last.fieldwork_end)} · {last.institute} · {format_pct(last.value)}" }
                            } else {
                                p { class: "muted", "Nenhuma observação disponível para este recorte." }
                            }
                        }

                        section { class: "cards",
                            div { class: "card",
                                div { class: "muted", "Pesquisas no recorte" }
                                div { class: "card-value", "{filtered.len()}" }
                            }
                            div { class: "card",
                                div { class: "muted", "Série" }
                                div { class: "card-value", "{state.candidate.label()}" }
                            }
                            div { class: "card",
                                div { class: "muted", "Região" }
                                div { class: "card-value", "{selected_geo}" }
                            }
                        }

                        section { class: "panel",
                            h2 { "Pesquisas exibidas" }
                            p { class: "muted", "Amostra da tabela para inspeção do novo front-end." }
                            div { class: "table-wrap",
                                table {
                                    thead { tr {
                                        th { "Fim de campo" }
                                        th { "Instituto" }
                                        th { "Geo" }
                                        th { "Cenário" }
                                        th { class: "num", "Valor" }
                                        th { class: "num", "N" }
                                    }}
                                    tbody {
                                        for poll in filtered.iter().rev().take(25) {
                                            tr {
                                                td { "{format_date(&poll.fieldwork_end)}" }
                                                td { "{poll.institute}" }
                                                td { "{poll.geo}" }
                                                td { "{poll.scenario}" }
                                                td { class: "num", "{format_pct(poll.value)}" }
                                                td { class: "num", "{poll.n:.0}" }
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
}

fn chart_svg(rows: &[Poll], trend: &[crate::chart::TrendPoint]) -> Element {
    let (min_day, max_day, low, high) = viewbox(rows, trend);
    let path = polyline_path(trend, min_day, max_day, low, high);
    let y_steps = 5;
    let x_steps = 6;

    rsx! {
        svg {
            class: "chart",
            view_box: "0 0 1100 470",
            role: "img",
            aria_label: "Gráfico customizado de pesquisas eleitorais",
            preserve_aspect_ratio: "none",
            width: "1100",
            height: "{HEIGHT}",
            rect { x: "0", y: "0", width: "1100", height: "{HEIGHT}", fill: "#0d1117" }

            for i in 0..=y_steps {
                let frac = i as f64 / y_steps as f64;
                let value = high - frac * (high - low);
                let y = y_for(value, low, high);
                line {
                    class: "grid-line",
                    x1: "{LEFT}", x2: "{1100.0 - RIGHT}",
                    y1: "{y:.2}", y2: "{y:.2}"
                }
                text {
                    class: "axis-label",
                    x: "8",
                    y: "{y + 4.0:.2}",
                    "{value:.1}%"
                }
            }

            for i in 0..=x_steps {
                let frac = i as f64 / x_steps as f64;
                let day = min_day + frac * (max_day - min_day);
                let label = format_day_axis(day);
                let x = LEFT + frac * (1100.0 - LEFT - RIGHT);
                line {
                    class: "grid-line",
                    x1: "{x:.2}", x2: "{x:.2}",
                    y1: "{TOP}", y2: "{HEIGHT - BOTTOM}"
                }
                text {
                    class: "axis-label",
                    x: "{x - 17.0:.2}",
                    y: "{HEIGHT - 17.0:.2}",
                    "{label}"
                }
            }

            polyline {
                class: "series-line",
                points: "{path}",
                style: "--series: #70a7ff;"
            }

            for poll in rows.iter() {
                let x = x_for(poll.day, min_day, max_day);
                let y = y_for(poll.value, low, high);
                circle {
                    class: "poll-point",
                    cx: "{x:.2}",
                    cy: "{y:.2}",
                    r: "4.5",
                }
                title { "{poll.institute} · {format_date(&poll.fieldwork_end)} · {format_pct(poll.value)}" }
            }
        }
    }
}

fn format_pct(value: f64) -> String {
    format!("{:.2}%", value)
}

fn format_date(value: &str) -> String {
    let s = value.get(..10).unwrap_or(value);
    let mut parts = s.split('-');
    let y = parts.next().unwrap_or("—");
    let m = parts.next().unwrap_or("—");
    let d = parts.next().unwrap_or("—");
    format!("{d}/{m}/{y}")
}

fn format_day_axis(day: f64) -> String {
    let z = day.floor() as i64 + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe/1460 + doe/36524 - doe/146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365*yoe + yoe/4 - yoe/100);
    let mp = (5*doy + 2) / 153;
    let d = doy - (153*mp+2)/5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    format!("{d:02}/{m:02}")
}
