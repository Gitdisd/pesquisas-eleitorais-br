use dioxus::prelude::*;
use gloo_timers::callback::Interval;
use polling_core::{uncertainty_band, PollObservation};
use crate::chart::{
    model_label, polyline_path, projection_v2_for_round, trend_for_model, viewbox, x_for, y_for,
    MODEL_OPTIONS, BOTTOM, HEIGHT, LEFT, RIGHT, TOP,
};
use crate::data::{available_geos, filter_polls, load_polls, Candidate, Poll};
use polling_core::ProjectionV2Result;

const STYLE: &str = include_str!("../assets/style.css");

#[derive(Clone, Copy, PartialEq)]
struct ViewState {
    candidate: Candidate,
    round: u8,
    range_days: Option<i64>,
    geo_index: usize,
    model: u8,
}

#[allow(non_snake_case)]
pub fn App() -> Element {
    let mut view = use_signal(|| ViewState {
        candidate: Candidate::Lula,
        round: 1,
        range_days: Some(30),
        geo_index: 0,
        model: 1,
    });

    let mut refresh_tick = use_signal(|| 0_u64);
    let _refresh_interval = use_hook(|| {
        let mut tick = refresh_tick;
        std::rc::Rc::new(Interval::new(60_000, move || {
            tick += 1;
        }))
    });
    let polls = use_resource(move || {
        let refresh_nonce = refresh_tick();
        async move { load_polls(refresh_nonce).await }
    });

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
                    let trend = trend_for_model(&filtered, 14.0, state.model);
                    let projection = if state.model == 2 {
                        Some(projection_v2_for_round(&filtered, state.round))
                    } else {
                        None
                    };
                    let latest = filtered.last();
                    let round_label = if state.round == 1 { "1º turno" } else { "2º turno" };
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
                                strong { "Modelo" }
                                for (model, label) in MODEL_OPTIONS.iter().copied() {
                                    button {
                                        class: if state.model == model { "active" } else { "" },
                                        onclick: move |_| view.write().model = model,
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
                            h2 { "{state.candidate.label()} — {round_label} · {model_label(state.model)}" }
                            p { class: "muted", "Pontos são pesquisas individuais; a linha usa o modelo selecionado. Data = fim de campo." }
                            div { class: "chart-wrap",
                                {chart_svg(&filtered, &trend, projection.as_ref())}
                            }
                            if state.model == 2 {
                                p { class: "muted projection-status", "{projection_status_text(projection.as_ref())}" }
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

fn chart_svg(rows: &[Poll], trend: &[crate::chart::TrendPoint], projection: Option<&ProjectionV2Result>) -> Element {
    let (min_day, max_day, low, high) = viewbox(rows, trend, projection);
    let path = polyline_path(trend, min_day, max_day, low, high);
    let uncertainty_rows: Vec<PollObservation> = rows.iter()
        .map(|row| PollObservation {
            t: row.day as f64 * 86_400_000.0,
            y: row.value,
            n: Some(row.n),
            institute: Some(row.institute.clone()),
            moe: row.moe,
        })
        .collect();
    let uncertainty = uncertainty_band(&uncertainty_rows, 14.0, 1.645);
    let band_points = {
        let mut points: Vec<String> = uncertainty.iter()
            .map(|point| format!("{:.2},{:.2}", x_for((point.x / 86_400_000.0).round() as i64, min_day, max_day), y_for(point.low, low, high)))
            .collect();
        points.extend(uncertainty.iter().rev()
            .map(|point| format!("{:.2},{:.2}", x_for((point.x / 86_400_000.0).round() as i64, min_day, max_day), y_for(point.high, low, high))));
        points.join(" ")
    };
    let point_coords: Vec<(&Poll, f64, f64)> = rows.iter()
        .map(|poll| (poll, x_for(poll.day, min_day, max_day), y_for(poll.value, low, high)))
        .collect();
    let projection_active = matches!(projection, Some(proj) if proj.ok && proj.line.len() > 1);
    let projection_band_points = if projection_active {
        let proj = projection.expect("projection is present when active");
        let mut points: Vec<String> = proj.band_low.iter()
            .map(|point| format!("{:.2},{:.2}", x_for((point.x / 86_400_000.0).round() as i64, min_day, max_day), y_for(point.y, low, high)))
            .collect();
        points.extend(proj.band_high.iter().rev()
            .map(|point| format!("{:.2},{:.2}", x_for((point.x / 86_400_000.0).round() as i64, min_day, max_day), y_for(point.y, low, high))));
        points.join(" ")
    } else {
        String::new()
    };
    let projection_path = if projection_active {
        let proj = projection.expect("projection is present when active");
        polyline_path(
            &proj.line.iter().map(|point| crate::chart::TrendPoint {
                day: (point.x / 86_400_000.0).round() as i64,
                value: point.y,
            }).collect::<Vec<_>>(),
            min_day,
            max_day,
            low,
            high,
        )
    } else {
        String::new()
    };
    let projection_divider_x = projection
        .filter(|proj| proj.ok)
        .and_then(|proj| proj.last_observed)
        .map(|x| x_for((x / 86_400_000.0).round() as i64, min_day, max_day))
        .unwrap_or(LEFT);

    let y_ticks: Vec<(f64, f64)> = (0..=5)
        .map(|i| {
            let frac = i as f64 / 5.0;
            let value = high - frac * (high - low);
            let y = y_for(value, low, high);
            (value, y)
        })
        .collect();
    let x_ticks: Vec<(f64, String)> = (0..=6)
        .map(|i| {
            let frac = i as f64 / 6.0;
            let day = min_day + frac * (max_day - min_day);
            let label = format_day_axis(day);
            let x = LEFT + frac * (1100.0 - LEFT - RIGHT);
            (x, label)
        })
        .collect();

    rsx! {
        svg {
            class: "chart",
            view_box: "0 0 1100 470",
            role: "img",
            "aria-label": "Gráfico customizado de pesquisas eleitorais",
                        width: "1100",
            height: "{HEIGHT}",
            rect { x: "0", y: "0", width: "1100", height: "{HEIGHT}", fill: "#0d1117" }

            for (value, y) in y_ticks.iter().copied() {
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

            for (x, label) in x_ticks.iter() {
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

            polygon {
                class: "uncertainty-band",
                points: "{band_points}"
            }

            if projection_active {
                line {
                    class: "projection-divider",
                    x1: "{projection_divider_x:.2}", x2: "{projection_divider_x:.2}",
                    y1: "{TOP}", y2: "{HEIGHT - BOTTOM}"
                }
                polygon {
                    class: "projection-band",
                    points: "{projection_band_points}"
                }
                polyline {
                    class: "projection-line",
                    points: "{projection_path}"
                }
            }

            polyline {
                class: "series-line",
                points: "{path}",
                style: "--series: #70a7ff;"
            }

            for (poll, x, y) in point_coords.iter().copied() {
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

fn projection_status_text(projection: Option<&ProjectionV2Result>) -> String {
    match projection {
        Some(proj) if proj.ok => {
            let steps = (proj.horizon_used.min(10) as usize).min(proj.line.len().saturating_sub(1));
            if steps == 0 {
                return "Projeção v2 disponível, sem horizonte futuro utilizável.".to_string();
            }
            let delta = proj.line[steps].y - proj.line[0].y;
            let delta_text = format!("{delta:+.1}").replace('.', ",");
            match proj.holdout.as_ref() {
                Some(gate) => format!(
                    "Projeção v2: {delta_text} pp/{steps}d · holdout RMSE modelo {:.2} vs persistência {:.2}.",
                    gate.rmse_model.unwrap_or(f64::NAN),
                    gate.rmse_persist.unwrap_or(f64::NAN),
                ),
                None => format!("Projeção v2: {delta_text} pp/{steps}d."),
            }
        }
        Some(proj) => format!(
            "Projeção v2 indisponível: {}.",
            proj.reason.as_deref().unwrap_or("motivo não informado"),
        ),
        None => "Projeção v2 indisponível: sem dados.".to_string(),
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
    let doy = doe - (365*yoe + yoe/4 - yoe/100);
    let mp = (5*doy + 2) / 153;
    let d = doy - (153*mp+2)/5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    format!("{d:02}/{m:02}")
}
