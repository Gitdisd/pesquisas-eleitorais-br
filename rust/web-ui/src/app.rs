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
    hover_day: Option<i64>,
    zoom: f64,
    pan_days: f64,
    pan_start: Option<(i32, f64, f64)>,
    pointer_a: Option<(i32, f64, f64)>,
    pointer_b: Option<(i32, f64, f64)>,
    pinch_last: Option<(f64, f64)>,
}

#[allow(non_snake_case)]
pub fn App() -> Element {
    let mut view = use_signal(|| ViewState {
        candidate: Candidate::Lula,
        round: 1,
        range_days: Some(30),
        geo_index: 0,
        model: 1,
        hover_day: None,
        zoom: 1.0,
        pan_days: 0.0,
        pan_start: None,
        pointer_a: None,
        pointer_b: None,
        pinch_last: None,
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
                                    onclick: move |_| { let mut state = view.write(); state.round = 1; reset_navigation(&mut state); },
                                    "1º turno"
                                }
                                button {
                                    class: if state.round == 2 { "active" } else { "" },
                                    onclick: move |_| { let mut state = view.write(); state.round = 2; reset_navigation(&mut state); },
                                    "2º turno"
                                }
                            }
                            div { class: "toolbar",
                                strong { "Janela" }
                                for (label, days) in [(("14d", Some(14_i64))), (("30d", Some(30_i64))), (("90d", Some(90_i64))), (("Tudo", None))] {
                                    button {
                                        class: if state.range_days == days { "active" } else { "" },
                                        onclick: move |_| { let mut state = view.write(); state.range_days = days; reset_navigation(&mut state); },
                                        "{label}"
                                    }
                                }
                            }
                            div { class: "toolbar",
                                strong { "Modelo" }
                                for (model, label) in MODEL_OPTIONS.iter().copied() {
                                    button {
                                        class: if state.model == model { "active" } else { "" },
                                        onclick: move |_| { let mut state = view.write(); state.model = model; reset_navigation(&mut state); },
                                        "{label}"
                                    }
                                }
                            }
                            div { class: "toolbar",
                                strong { "Geografia" }
                                button {
                                    class: if state.geo_index == all_index { "active" } else { "" },
                                    onclick: move |_| { let mut state = view.write(); state.geo_index = all_index; reset_navigation(&mut state); },
                                    "Todas"
                                }
                                for (index, geo) in geos.iter().enumerate() {
                                    button {
                                        class: if state.geo_index == index { "active" } else { "" },
                                        onclick: move |_| { let mut state = view.write(); state.geo_index = index; reset_navigation(&mut state); },
                                        "{geo}"
                                    }
                                }
                            }
                            div { class: "chips",
                                strong { "Série" }
                                for candidate in Candidate::all().iter().copied() {
                                    button {
                                        class: if state.candidate == candidate { "active" } else { "" },
                                        onclick: move |_| { let mut state = view.write(); state.candidate = candidate; reset_navigation(&mut state); },
                                        "{candidate.label()}"
                                    }
                                }
                            }
                        }

                        section { class: "panel",
                            h2 { "{state.candidate.label()} — {round_label} · {model_label(state.model)}" }
                            p { class: "muted", "Pontos são pesquisas individuais; a linha usa o modelo selecionado. Data = fim de campo." }
                            div { class: "chart-wrap",
                                {chart_svg(&filtered, &trend, projection.as_ref(), state.hover_day, view)}
                            }
                            div { class: "chart-navigation",
                                button {
                                    onclick: move |_| reset_navigation(&mut view.write()),
                                    "Recentrar"
                                }
                                span { class: "muted", "Zoom {state.zoom:.1}×" }
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

fn chart_svg(rows: &[Poll], trend: &[crate::chart::TrendPoint], projection: Option<&ProjectionV2Result>, hover_day: Option<i64>, mut view: Signal<ViewState>) -> Element {
    let current_view = view();
    let (base_min_day, base_max_day, low, high) = viewbox(rows, trend, projection);
    let (min_day, max_day) = navigation_window(base_min_day, base_max_day, current_view.zoom, current_view.pan_days);
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
    let hover_x = hover_day.map(|day| x_for(day, min_day, max_day));
    let hover_poll = hover_day.and_then(|day| {
        rows.iter().min_by_key(|poll| (poll.day - day).abs())
    });
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
            onmousemove: move |event| {
                let x = event.data().element_coordinates().x;
                let plot_width = 1100.0 - LEFT - RIGHT;
                let clamped = x.clamp(LEFT, LEFT + plot_width);
                let day = (min_day + ((clamped - LEFT) / plot_width) * (max_day - min_day)).round() as i64;
                view.write().hover_day = Some(day);
            },
            onmouseleave: move |_| {
                view.write().hover_day = None;
            },
            onwheel: move |event| {
                event.prevent_default();
                let data = event.data();
                let x = data.element_coordinates().x.clamp(LEFT, LEFT + (1100.0 - LEFT - RIGHT));
                let delta_y = data.delta().strip_units().y;
                if delta_y.abs() < 0.01 {
                    return;
                }
                let mut state = view.write();
                let (zoom, pan_days) = zoom_around(
                    base_min_day,
                    base_max_day,
                    state.zoom,
                    state.pan_days,
                    x,
                    delta_y,
                );
                state.zoom = zoom;
                state.pan_days = pan_days;
                state.hover_day = Some(day_from_x(x, min_day, max_day).round() as i64);
            },
            onpointerdown: move |event| {
                event.prevent_default();
                let data = event.data();
                let id = data.pointer_id();
                let x = data.element_coordinates().x;
                let y = data.element_coordinates().y;
                let mut state = view.write();

                if state.pointer_a.map(|point| point.0) == Some(id) || state.pointer_b.map(|point| point.0) == Some(id) {
                    return;
                }

                if state.pointer_a.is_none() {
                    state.pointer_a = Some((id, x, y));
                    state.pan_start = Some((id, x, state.pan_days));
                } else if state.pointer_b.is_none() {
                    state.pointer_b = Some((id, x, y));
                    state.pinch_last = pinch_geometry(state.pointer_a, state.pointer_b);
                }
            },
            onpointermove: move |event| {
                event.prevent_default();
                let data = event.data();
                let id = data.pointer_id();
                let x = data.element_coordinates().x;
                let y = data.element_coordinates().y;
                let mut state = view.write();

                update_pointer(&mut state.pointer_a, id, x, y);
                update_pointer(&mut state.pointer_b, id, x, y);

                if let (Some(a), Some(b)) = (state.pointer_a, state.pointer_b) {
                    let (distance, midpoint_x) = pinch_geometry(a, b).unwrap_or((0.0, (a.1 + b.1) / 2.0));
                    if distance > 1.0 {
                        if let Some((last_distance, last_midpoint_x)) = state.pinch_last {
                            let old_zoom = state.zoom;
                            let (old_min, old_max) = navigation_window(
                                base_min_day,
                                base_max_day,
                                old_zoom,
                                state.pan_days,
                            );
                            let anchor_day = day_from_x(last_midpoint_x, old_min, old_max);
                            let ratio = (distance / last_distance).clamp(0.85, 1.18);
                            let new_zoom = (old_zoom * ratio).clamp(1.0, MAX_ZOOM);
                            state.pan_days = pan_to_anchor(
                                base_min_day,
                                base_max_day,
                                new_zoom,
                                anchor_day,
                                midpoint_x,
                            );
                            state.zoom = new_zoom;
                        }
                        state.pinch_last = Some((distance, midpoint_x));
                    }
                } else if let Some((start_id, start_x, start_pan)) = state.pan_start {
                    if start_id == id {
                        state.pan_days = pan_by_pixels(
                            base_min_day,
                            base_max_day,
                            state.zoom,
                            start_pan,
                            x - start_x,
                        );
                    }
                }
            },
            onpointerup: move |event| {
                event.prevent_default();
                release_pointer(&mut view.write(), event.data().pointer_id());
            },
            onpointercancel: move |event| {
                event.prevent_default();
                release_pointer(&mut view.write(), event.data().pointer_id());
            },
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

            if let Some(x) = hover_x {
                line {
                    class: "hover-crosshair",
                    x1: "{x:.2}", x2: "{x:.2}",
                    y1: "{TOP}", y2: "{HEIGHT - BOTTOM}"
                }
            }

            if let Some(poll) = hover_poll {
                rect {
                    class: "hover-tooltip",
                    x: "{(hover_x.unwrap_or(LEFT) + 10.0).min(930.0):.2}",
                    y: "{TOP + 8.0}",
                    width: "160", height: "52", rx: "5"
                }
                text {
                    class: "hover-tooltip-text",
                    x: "{(hover_x.unwrap_or(LEFT) + 18.0).min(938.0):.2}",
                    y: "{TOP + 27.0}",
                    "{format_date(&poll.fieldwork_end)} · {format_pct(poll.value)}"
                }
                text {
                    class: "hover-tooltip-text",
                    x: "{(hover_x.unwrap_or(LEFT) + 18.0).min(938.0):.2}",
                    y: "{TOP + 45.0}",
                    "{poll.institute}"
                }
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

const MAX_ZOOM: f64 = 12.0;

fn reset_navigation(state: &mut ViewState) {
    state.zoom = 1.0;
    state.pan_days = 0.0;
    state.hover_day = None;
    state.pan_start = None;
    state.pointer_a = None;
    state.pointer_b = None;
    state.pinch_last = None;
}

fn navigation_window(base_min_day: f64, base_max_day: f64, zoom: f64, pan_days: f64) -> (f64, f64) {
    let base_span = (base_max_day - base_min_day).max(1.0);
    let zoom = if zoom.is_finite() { zoom.clamp(1.0, MAX_ZOOM) } else { 1.0 };
    let span = (base_span / zoom).max(1.0);
    let max_pan = ((base_span - span) / 2.0).max(0.0);
    let pan = if pan_days.is_finite() {
        pan_days.clamp(-max_pan, max_pan)
    } else {
        0.0
    };
    let center = (base_min_day + base_max_day) / 2.0 + pan;
    (
        center - span / 2.0,
        center + span / 2.0,
    )
}

fn day_from_x(x: f64, min_day: f64, max_day: f64) -> f64 {
    let plot_width = (1100.0 - LEFT - RIGHT).max(1.0);
    let frac = ((x - LEFT) / plot_width).clamp(0.0, 1.0);
    min_day + frac * (max_day - min_day)
}

fn pan_to_anchor(
    base_min_day: f64,
    base_max_day: f64,
    zoom: f64,
    anchor_day: f64,
    anchor_x: f64,
) -> f64 {
    let base_span = (base_max_day - base_min_day).max(1.0);
    let zoom = zoom.clamp(1.0, MAX_ZOOM);
    let span = (base_span / zoom).max(1.0);
    let frac = ((anchor_x - LEFT) / (1100.0 - LEFT - RIGHT).max(1.0)).clamp(0.0, 1.0);
    let target_min = anchor_day - frac * span;
    let target_center = target_min + span / 2.0;
    let base_center = (base_min_day + base_max_day) / 2.0;
    let max_pan = ((base_span - span) / 2.0).max(0.0);
    (target_center - base_center).clamp(-max_pan, max_pan)
}

fn pan_by_pixels(
    base_min_day: f64,
    base_max_day: f64,
    zoom: f64,
    start_pan: f64,
    delta_x: f64,
) -> f64 {
    let (min_day, max_day) = navigation_window(base_min_day, base_max_day, zoom, start_pan);
    let span = max_day - min_day;
    let pan = start_pan - delta_x / (1100.0 - LEFT - RIGHT).max(1.0) * span;
    let base_span = (base_max_day - base_min_day).max(1.0);
    let visible_span = span.max(1.0);
    let max_pan = ((base_span - visible_span) / 2.0).max(0.0);
    pan.clamp(-max_pan, max_pan)
}

fn zoom_around(
    base_min_day: f64,
    base_max_day: f64,
    current_zoom: f64,
    current_pan: f64,
    cursor_x: f64,
    delta_y: f64,
) -> (f64, f64) {
    let (min_day, max_day) = navigation_window(base_min_day, base_max_day, current_zoom, current_pan);
    let anchor_day = day_from_x(cursor_x, min_day, max_day);
    let factor = (-delta_y * 0.0015).exp();
    let new_zoom = (current_zoom * factor).clamp(1.0, MAX_ZOOM);
    if (new_zoom - current_zoom).abs() < 1e-9 {
        return (current_zoom, current_pan);
    }
    (
        new_zoom,
        pan_to_anchor(base_min_day, base_max_day, new_zoom, anchor_day, cursor_x),
    )
}

fn pinch_geometry(
    a: Option<(i32, f64, f64)>,
    b: Option<(i32, f64, f64)>,
) -> Option<(f64, f64)> {
    let (Some(a), Some(b)) = (a, b) else {
        return None;
    };
    let distance = ((a.1 - b.1).powi(2) + (a.2 - b.2).powi(2)).sqrt();
    Some((distance, (a.1 + b.1) / 2.0))
}

fn update_pointer(slot: &mut Option<(i32, f64, f64)>, id: i32, x: f64, y: f64) {
    if let Some(point) = slot.as_mut() {
        if point.0 == id {
            point.1 = x;
            point.2 = y;
        }
    }
}

fn release_pointer(state: &mut ViewState, id: i32) {
    if state.pointer_a.map(|point| point.0) == Some(id) {
        state.pointer_a = None;
    }
    if state.pointer_b.map(|point| point.0) == Some(id) {
        state.pointer_b = None;
    }

    state.pinch_last = None;
    state.pan_start = match (state.pointer_a, state.pointer_b) {
        (Some(point), _) => Some((point.0, point.1, state.pan_days)),
        (None, Some(point)) => Some((point.0, point.1, state.pan_days)),
        (None, None) => None,
    };
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
