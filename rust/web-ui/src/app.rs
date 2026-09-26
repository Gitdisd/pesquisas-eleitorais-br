use dioxus::prelude::*;
use gloo_timers::callback::Interval;
use polling_core::{
    project_trend, uncertainty_band, PollObservation, ProjectionV2Result,
    ELECTION_ROUND1_MS, ELECTION_ROUND2_MS,
};
use std::collections::BTreeSet;

use crate::chart::{
    model_label, polyline_path, projection_v2_for_round, trend_for_model, viewbox, x_for, y_for,
    MODEL_OPTIONS, BOTTOM, HEIGHT, LEFT, RIGHT, TOP,
};
use crate::data::{available_geos, filter_polls, load_meta, load_polls, load_regional_polls, Candidate, Poll};
use crate::methodology::Methodology;
use crate::overlays::{compute_overlay, OVERLAYS};
use crate::regional::RegionalPanel;
use crate::ui::{
    apply_document_chrome, build_share_url, copy_text, csv_export, fullscreen, json_export,
    initial_avg_window_days, initial_model, initial_range_days, initial_round,
    persist_language, persist_model, persist_overlays, persist_theme, scroll_to_id,
    t, Language, Theme, UiState,
};

const STYLE: &str = include_str!("../assets/style.css");

#[derive(Clone)]
struct TablePoll {
    rows: Vec<Poll>,
}

#[derive(Clone, Copy, PartialEq)]
struct ViewState {
    candidate: Candidate,
    round: u8,
    range_days: Option<i64>,
    avg_window_days: i64,
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
        round: initial_round(),
        range_days: initial_range_days(),
        avg_window_days: initial_avg_window_days(),
        geo_index: usize::MAX,
        model: initial_model(),
        hover_day: None,
        zoom: 1.0,
        pan_days: 0.0,
        pan_start: None,
        pointer_a: None,
        pointer_b: None,
        pinch_last: None,
    });
    let mut ui = use_signal(UiState::restored);

    use_effect({
        let ui = ui;
        move || {
            let language = ui().language;
            apply_document_chrome(language);
        }
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
    let regional_polls = use_resource(move || {
        let refresh_nonce = refresh_tick();
        async move { load_regional_polls(refresh_nonce).await }
    });
    let meta = use_resource(move || {
        let refresh_nonce = refresh_tick();
        async move { load_meta(refresh_nonce).await }
    });

    use_effect({
        let ui = ui;
        move || {
            if matches!(polls.read().as_ref(), Some(Ok(_))) {
                ui.write().status = None;
            }
        }
    });

    let ui_state = ui();
    let shell_style = ui_state.theme_style();
    let meta_state = meta.read();
    let meta_updated = meta_state.as_ref().and_then(|value| value.as_ref()).and_then(|value| value.last_updated.as_deref()).map(format_meta_stamp).unwrap_or_else(|| "—".to_string());
    let meta_latest = meta_state.as_ref().and_then(|value| value.as_ref()).and_then(|value| value.latest_publication_date.as_deref()).map(format_meta_date).unwrap_or_else(|| "—".to_string());
    let meta_check = meta_state.as_ref().and_then(|value| value.as_ref()).and_then(|value| value.last_check_at.as_deref()).map(format_meta_stamp).unwrap_or_else(|| "—".to_string());

    rsx! {
        div {
            id: "appShell",
            class: "app-shell",
            style: "{shell_style}",
            header {
                class: "app-header",
                div {
                    class: "app",
                    div {
                        class: "header-top",
                        div {
                            class: "header-copy",
                            div { class: "brandline",
                                span { class: "kicker", "{t(ui_state.language, "dashboard")}" }
                                span { class: "live-pill", "● {t(ui_state.language, "public-data")}" }
                            }
                            h1 { "Pesquisas eleitorais — Presidência 2026" }
                            p { "{t(ui_state.language, "source-note")}" }
                            div { class: "meta-strip",
                                span { "Atualizado: {meta_updated}" }
                                span { "Última publicação: {meta_latest}" }
                                span { "Verificação: {meta_check}" }
                            }
                            div { class: "site-controls",
                                div { class: "control-group",
                                    span { class: "control-label", "{t(ui_state.language, "language")}" }
                                    button {
                                        class: if ui_state.language == Language::PtBr { "active" } else { "" },
                                        "aria-pressed": "{ui_state.language == Language::PtBr}",
                                        onclick: move |_| {
                                            let language = Language::PtBr;
                                            ui.write().language = language;
                                            persist_language(language);
                                            apply_document_chrome(language);
                                        },
                                        "Português"
                                    }
                                    button {
                                        class: if ui_state.language == Language::En { "active" } else { "" },
                                        "aria-pressed": "{ui_state.language == Language::En}",
                                        onclick: move |_| {
                                            let language = Language::En;
                                            ui.write().language = language;
                                            persist_language(language);
                                            apply_document_chrome(language);
                                        },
                                        "English"
                                    }
                                }
                                div { class: "control-group",
                                    span { class: "control-label", "{t(ui_state.language, "themes")}" }
                                    for theme in [Theme::Light, Theme::Dark, Theme::CrtAmber, Theme::CrtGreen] {
                                        button {
                                            class: if ui_state.theme == theme { "active" } else { "" },
                                            "aria-pressed": "{ui_state.theme == theme}",
                                            onclick: move |_| {
                                                ui.write().theme = theme;
                                                persist_theme(theme);
                                            },
                                            "{theme.label(ui_state.language)}"
                                        }
                                    }
                                    for theme in [Theme::Pt, Theme::Pl, Theme::Missao, Theme::Psd, Theme::Novo, Theme::Avante] {
                                        button {
                                            class: if ui_state.theme == theme { "active party-theme" } else { "party-theme" },
                                            "aria-pressed": "{ui_state.theme == theme}",
                                            onclick: move |_| {
                                                ui.write().theme = theme;
                                                persist_theme(theme);
                                            },
                                            "{theme.label(ui_state.language)}"
                                        }
                                    }
                                }
                                a {
                                    class: "x-follow",
                                    href: "https://x.com/Monkeeuphoria",
                                    target: "_blank",
                                    rel: "noopener noreferrer",
                                    "aria-label": if ui_state.language == Language::En { "Follow @Monkeeuphoria on X" } else { "Seguir @Monkeeuphoria no X" },
                                    img { class: "x-pfp", src: "https://unavatar.io/x/Monkeeuphoria", alt: "" }
                                    span { "@Monkeeuphoria · {t(ui_state.language, "follow")}" }
                                }
                                button {
                                    class: "ui-btn refresh-btn",
                                    onclick: move |_| {
                                        refresh_tick += 1;
                                        ui.write().status = Some(if ui_state.language == Language::En {
                                            "Refreshing published data…".to_string()
                                        } else {
                                            "Atualizando dados publicados…".to_string()
                                        });
                                    },
                                    if ui_state.language == Language::En { "↻ Refresh" } else { "↻ Atualizar" }
                                }
                            }
                        }
                    }
                    nav { class: "dashboard-nav", "aria-label": "Navegação rápida",
                        a { href: "#overview", "{t(ui_state.language, "overview")}" }
                        a { href: "#chartPanel", "Gráfico" }
                        a { href: "#cards", "Resumo" }
                        a { href: "#pollsPanel", "{t(ui_state.language, "polls")}" }
                        a { href: "#allSourcesPanel", "Fontes" }
                        a { href: "#methodology", "Metodologia" }
                    }
                }
            }

            div { class: "app",
                match polls.read().as_ref() {
                    None => rsx! { section { class: "panel status", "{t(ui_state.language, "loading")}" } },
                    Some(Err(error)) => rsx! { section { class: "panel status", "{error}" } },
                    Some(Ok(all)) => {
                        let state = view();
                        let geos = available_geos(all);
                        let all_index = geos.len();
                        let selected_geo = if state.geo_index == all_index || state.geo_index == usize::MAX {
                            "ALL".to_string()
                        } else {
                            geos.get(state.geo_index).cloned().unwrap_or_else(|| "BR".to_string())
                        };

                        let mut filtered = filter_polls(all, state.candidate, state.round, &selected_geo, state.range_days);
                        if !ui_state.institutes.is_empty() {
                            filtered.retain(|poll| ui_state.institutes.iter().any(|name| name == &poll.institute));
                        }

                        let mut all_institutes: Vec<String> = all.iter().map(|poll| poll.institute.clone()).collect();
                        all_institutes.sort();
                        all_institutes.dedup();

                        let round_label = if state.round == 1 {
                            t(ui_state.language, "first-round")
                        } else {
                            t(ui_state.language, "second-round")
                        };
                        let trend = trend_for_model(&filtered, state.avg_window_days as f64, state.model);
                        let projection = if state.model == 2 {
                            Some(projection_v2_for_round(&filtered, state.round))
                        } else {
                            None
                        };
                        let latest = filtered.last();
                        let table_query = ui_state.table_query.trim().to_lowercase();
                        let mut table_source: Vec<Poll> = all.iter()
                            .filter(|poll| poll.round == state.round)
                            .filter(|poll| selected_geo == "ALL" || poll.geo == selected_geo)
                            .filter(|poll| ui_state.institute_selected(&poll.institute))
                            .cloned()
                            .collect();
                        if let Some(days) = state.range_days {
                            if let Some(max_day) = table_source.iter().map(|poll| poll.day).max() {
                                let min_day = max_day - days;
                                table_source.retain(|poll| poll.day >= min_day);
                            }
                        }
                        let mut grouped = std::collections::BTreeMap::<String, Vec<Poll>>::new();
                        for poll in table_source {
                            grouped.entry(poll.id.clone()).or_default().push(poll);
                        }
                        let mut table_polls: Vec<TablePoll> = grouped.into_values()
                            .map(|mut rows| {
                                rows.sort_by(|a, b| a.candidate_key.cmp(&b.candidate_key));
                                TablePoll { rows }
                            })
                            .collect();
                        table_polls.sort_by(|a, b| {
                            let ad = a.rows.first().map(|row| row.day).unwrap_or(i64::MIN);
                            let bd = b.rows.first().map(|row| row.day).unwrap_or(i64::MIN);
                            bd.cmp(&ad)
                        });
                        if !table_query.is_empty() {
                            table_polls.retain(|poll| poll.rows.iter().any(|row| {
                                row.institute.to_lowercase().contains(&table_query)
                                    || row.scenario.to_lowercase().contains(&table_query)
                                    || row.geo.to_lowercase().contains(&table_query)
                                    || row.fieldwork_end.to_lowercase().contains(&table_query)
                                    || row.candidate_key.to_lowercase().contains(&table_query)
                            }));
                        }
                        let table_count = table_polls.len();
                        let export_rows = table_polls.iter()
                            .flat_map(|poll| poll.rows.iter().cloned())
                            .collect::<Vec<_>>();
                        let json_rows = filtered.clone();
                        let share_institutes = ui_state.institutes.clone();
                        let latest_all = all.iter().max_by_key(|poll| poll.day);
                        let overview_poll_count = unique_poll_count(all, None);
                        let overview_institutes = all_institutes.len();
                        let round1_count = unique_poll_count(all, Some(1));
                        let round2_count = unique_poll_count(all, Some(2));
                        let latest_label = latest_all.map(|poll| format_date(&poll.fieldwork_end)).unwrap_or_else(|| "—".into());

                        rsx! {
                            section { class: "dashboard-overview", id: "overview",
                                div { class: "overview-hero",
                                    div {
                                        h2 { "{t(ui_state.language, "overview")}" }
                                        p { "{t(ui_state.language, "overview-copy")}" }
                                    }
                                    div { class: "overview-actions",
                                        button {
                                            class: "ui-btn",
                                            onclick: move |_| scroll_to_id("chartPanel"),
                                            "{t(ui_state.language, "open-chart")}"
                                        }
                                        button {
                                            class: "ui-btn",
                                            onclick: move |_| scroll_to_id("pollsPanel"),
                                            "{t(ui_state.language, "view-polls")}"
                                        }
                                    }
                                }
                                div { class: "metrics-grid",
                                    div { class: "metric",
                                        span { class: "metric-label", "{t(ui_state.language, "published-polls")}" }
                                        span { class: "metric-value", "{overview_poll_count}" }
                                        span { class: "metric-sub", "{t(ui_state.language, "national-base")}" }
                                    }
                                    div { class: "metric",
                                        span { class: "metric-label", "{t(ui_state.language, "pollsters")}" }
                                        span { class: "metric-value", "{overview_institutes}" }
                                        span { class: "metric-sub", "{t(ui_state.language, "loaded-data")}" }
                                    }
                                    div { class: "metric",
                                        span { class: "metric-label", "{t(ui_state.language, "latest-fieldwork")}" }
                                        span { class: "metric-value", "{latest_label}" }
                                        span { class: "metric-sub", "{t(ui_state.language, "fieldwork-end" )}" }
                                    }
                                    div { class: "metric",
                                        span { class: "metric-label", "{t(ui_state.language, "round-coverage")}" }
                                        span { class: "metric-value", "{round1_count} · {round2_count}" }
                                        span { class: "metric-sub", "{t(ui_state.language, "first-round")} · {t(ui_state.language, "second-round")}" }
                                    }
                                }
                            }

                            section { class: "panel chart-panel", id: "chartPanel",
                                div { class: "chart-head-row",
                                    h2 { class: "chart-title", "Evolução da intenção de voto" }
                                    div { class: "chart-actions",
                                        button {
                                            class: "ui-btn",
                                            onclick: move |_| scroll_to_id("chartPanel"),
                                            "↗ {t(ui_state.language, "focus")}"
                                        }
                                        button {
                                            class: "ui-btn",
                                            onclick: move |_| {
                                                if !fullscreen("appShell") {
                                                    ui.write().status = Some(t(ui_state.language, "full-screen-unavailable").to_string());
                                                }
                                            },
                                            "⛶ {t(ui_state.language, "fullscreen")}"
                                        }
                                    }
                                }

                                div { class: "controls controls-primary",
                                    div { class: "seg", role: "group", "aria-label": t(ui_state.language, "round"),
                                        button {
                                            class: if state.round == 1 { "active" } else { "" },
                                            onclick: move |_| { let mut state = view.write(); state.round = 1; reset_navigation(&mut state); },
                                            "{t(ui_state.language, "first-round")}"
                                        }
                                        button {
                                            class: if state.round == 2 { "active" } else { "" },
                                            onclick: move |_| { let mut state = view.write(); state.round = 2; reset_navigation(&mut state); },
                                            "{t(ui_state.language, "second-round")}"
                                        }
                                    }
                                    div { class: "seg range-seg", role: "group", "aria-label": t(ui_state.language, "period"),
                                        for (label, days) in [
                                            ("1d", Some(1_i64)), ("3d", Some(3_i64)), ("7d", Some(7_i64)),
                                            ("14d", Some(14_i64)), ("21d", Some(21_i64)), ("30d", Some(30_i64)),
                                            ("90d", Some(90_i64)),
                                        ] {
                                            button {
                                                class: if state.range_days == days { "active" } else { "" },
                                                onclick: move |_| { let mut state = view.write(); state.range_days = days; reset_navigation(&mut state); },
                                                "{label}"
                                            }
                                        }
                                        button {
                                            class: if state.range_days.is_none() { "active" } else { "" },
                                            onclick: move |_| { let mut state = view.write(); state.range_days = None; reset_navigation(&mut state); },
                                            "{t(ui_state.language, "all-period")}"
                                        }
                                    }
                                }

                                div { class: "controls controls-secondary",
                                    div { class: "window-row",
                                        span { class: "ctrl", "{t(ui_state.language, "averaging-window")}" }
                                        div { class: "window-presets",
                                            for days in [7_i64, 14_i64, 30_i64, 90_i64] {
                                                button {
                                                    class: if state.avg_window_days == days { "chip on" } else { "chip" },
                                                    onclick: move |_| {
                                                        let mut state = view.write();
                                                        state.avg_window_days = days;
                                                        reset_navigation(&mut state);
                                                    },
                                                    "{days}d"
                                                }
                                            }
                                            button {
                                                class: if state.avg_window_days == 365 { "chip on" } else { "chip" },
                                                onclick: move |_| {
                                                    let mut state = view.write();
                                                    state.avg_window_days = 365;
                                                    reset_navigation(&mut state);
                                                },
                                                "YTD"
                                            }
                                        }
                                        label { class: "ctrl",
                                            "{t(ui_state.language, "custom")}"
                                            input {
                                                r#type: "number",
                                                min: "1",
                                                step: "1",
                                                value: "{state.avg_window_days}",
                                                oninput: move |event| {
                                                    if let Ok(days) = event.value().parse::<i64>() {
                                                        let mut state = view.write();
                                                        state.avg_window_days = days.max(1);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    div { class: "axis-btns",
                                        button {
                                            class: "chip btn-reset",
                                            onclick: move |_| reset_navigation(&mut view.write()),
                                            "Resetar eixos"
                                        }
                                    }
                                }

                                div { class: "candidate-focus",
                                    span { class: "candidate-focus-label", "Linhas do gráfico" }
                                    {
                                        let focus_candidates: Vec<Candidate> = if state.round == 2 {
                                            vec![Candidate::Lula, Candidate::Flavio, Candidate::BrancoNulo]
                                        } else {
                                            Candidate::all().to_vec()
                                        };
                                        rsx! {
                                            for candidate in focus_candidates {
                                                let hidden = ui_state.hidden_candidates.iter().any(|key| key == candidate.key());
                                                button {
                                                    class: if hidden { "candidate-focus-btn" } else { "candidate-focus-btn on" },
                                                    "aria-pressed": "{!hidden}",
                                                    onclick: move |_| {
                                                        let mut next = ui.write();
                                                        if next.hidden_candidates.iter().any(|key| key == candidate.key()) {
                                                            next.hidden_candidates.retain(|key| key != candidate.key());
                                                        } else {
                                                            next.hidden_candidates.push(candidate.key().to_string());
                                                        }
                                                    },
                                                    "{candidate.label()}"
                                                }
                                            }
                                        }
                                    }
                                }

                                div { class: "overlay-row",
                                    span { class: "ctrl", "Overlays" }
                                    for overlay in OVERLAYS.iter().copied() {
                                        let enabled = ui_state.overlays.iter().any(|key| key == overlay.id);
                                        button {
                                            class: if enabled { "chip on" } else { "chip" },
                                            "aria-pressed": "{enabled}",
                                            onclick: move |_| {
                                                let mut next = ui.write();
                                                if next.overlays.iter().any(|key| key == overlay.id) {
                                                    next.overlays.retain(|key| key != overlay.id);
                                                } else {
                                                    next.overlays.push(overlay.id.to_string());
                                                }
                                                persist_overlays(&next.overlays);
                                            },
                                            "{overlay.label}"
                                        }
                                    }
                                }

                                div { class: "filter-drawer",
                                    div { class: "filter-header",
                                        strong { "{t(ui_state.language, "filters")}" }
                                        span { class: "muted", "{t(ui_state.language, "filter-help")}" }
                                    }
                                    div { class: "filters",
                                        button {
                                            class: if ui_state.institutes.is_empty() { "chip on" } else { "chip" },
                                            onclick: move |_| ui.write().institutes.clear(),
                                            "{t(ui_state.language, "select-all")} ({all_institutes.len()})"
                                        }
                                        for institute in all_institutes.iter() {
                                            let name = institute.clone();
                                            let active = ui_state.institute_selected(&name);
                                            button {
                                                class: if active { "chip on" } else { "chip" },
                                                "aria-pressed": "{active}",
                                                onclick: move |_| {
                                                    let mut state = ui.write();
                                                    if state.institutes.is_empty() {
                                                        state.institutes = all_institutes.iter().filter(|item| *item != &name).cloned().collect();
                                                    } else if state.institutes.iter().any(|item| item == &name) {
                                                        if state.institutes.len() > 1 {
                                                            state.institutes.retain(|item| item != &name);
                                                        }
                                                    } else {
                                                        state.institutes.push(name.clone());
                                                        state.institutes.sort();
                                                    }
                                                },
                                                "{name}"
                                            }
                                        }
                                    }
                                }

                                div { class: "chart-box", {multi_chart_svg(
                                    all,
                                    state.round,
                                    &selected_geo,
                                    state.range_days,
                                    &ui_state.institutes,
                                    state.model,
                                    state.avg_window_days as f64,
                                    &ui_state.hidden_candidates,
                                    &ui_state.overlays,
                                    state.hover_day,
                                    view,
                                )} }

                                div { class: "chart-navigation",
                                    button {
                                        onclick: move |_| reset_navigation(&mut view.write()),
                                        "{t(ui_state.language, "reset-view")}"
                                    }
                                    span { class: "muted", "Zoom {state.zoom:.1}×" }
                                }
                                if let Some(status) = ui_state.status.as_ref() {
                                    p { class: "action-status", role: "status", "{status}" }
                                }
                                p { class: "quick-note",
                                    strong { "{t(ui_state.language, "guide")}:" }
                                    " {t(ui_state.language, "guide-copy")}"
                                }
                                div { class: "quick-tools",
                                    button {
                                        class: "ui-btn primary",
                                        onclick: move |_| {
                                            let url = build_share_url(
                                                state.round,
                                                state.range_days,
                                                state.avg_window_days,
                                                state.model,
                                                state.candidate.key(),
                                                &selected_geo,
                                                &share_institutes,
                                            );
                                            let message = match url {
                                                Some(url) if copy_text(&url) => t(ui_state.language, "copy-link"),
                                                _ => t(ui_state.language, "sharing-unavailable"),
                                            };
                                            ui.write().status = Some(message.to_string());
                                        },
                                        "{t(ui_state.language, "share")}"
                                    }
                                    button {
                                        class: "ui-btn",
                                        onclick: move |_| {
                                            let ok = csv_export(&export_rows);
                                            ui.write().status = Some(if ok {
                                                t(ui_state.language, "exported-csv").to_string()
                                            } else {
                                                t(ui_state.language, "sharing-unavailable").to_string()
                                            });
                                        },
                                        "{t(ui_state.language, "export-csv")}"
                                    }
                                    button {
                                        class: "ui-btn",
                                        onclick: move |_| {
                                            let ok = json_export(
                                                &json_rows,
                                                state.round,
                                                state.range_days,
                                                state.avg_window_days,
                                                state.model,
                                                state.candidate.key(),
                                                &selected_geo,
                                            );
                                            ui.write().status = Some(if ok {
                                                t(ui_state.language, "exported-json").to_string()
                                            } else {
                                                t(ui_state.language, "sharing-unavailable").to_string()
                                            });
                                        },
                                        "{t(ui_state.language, "export-json")}"
                                    }
                                    button {
                                        class: "ui-btn",
                                        onclick: move |_| scroll_to_id("chartPanel"),
                                        "{t(ui_state.language, "focus")}"
                                    }
                                }

                                h2 { class: "chart-subtitle", "{state.candidate.label()} — {round_label} · {model_label(state.model)}" }
                                p { class: "muted", "{t(ui_state.language, "source-note")}" }

                                if state.model == 2 {
                                    p { class: "muted projection-status", "{projection_status_text(projection.as_ref(), ui_state.language)}" }
                                }
                                if let Some(last) = latest {
                                    p { class: "muted", "{t(ui_state.language, "latest-shown")}: {format_date(&last.fieldwork_end)} · {last.institute} · {format_pct(last.value)}" }
                                } else {
                                    p { class: "muted", "{t(ui_state.language, "no-observations")}" }
                                }
                            }

                            section { class: "cards candidate-cards", id: "cards",
                                {
                                    let card_candidates: Vec<Candidate> = if state.round == 2 {
                                        vec![Candidate::Lula, Candidate::Flavio]
                                    } else {
                                        Candidate::all().to_vec()
                                    };
                                    let card_source: Vec<Poll> = all.iter()
                                        .filter(|poll| poll.round == state.round)
                                        .filter(|poll| selected_geo == "ALL" || poll.geo == selected_geo)
                                        .filter(|poll| ui_state.institute_selected(&poll.institute))
                                        .cloned()
                                        .collect();
                                    rsx! {
                                        for candidate in card_candidates {
                                            {
                                                let key = candidate.key();
                                                let rows: Vec<Poll> = card_source.iter()
                                                    .filter(|poll| poll.candidate_key == key)
                                                    .cloned()
                                                    .collect();
                                                let trend = trend_for_model(&rows, state.avg_window_days as f64, state.model);
                                                let now_day = rows.iter().map(|poll| poll.day).max();
                                                let current = now_day.and_then(|day| nearest_trend_value(&trend, day));
                                                let prior = now_day.and_then(|day| nearest_trend_value(&trend, day - 30));
                                                let delta = match (current, prior) {
                                                    (Some(current), Some(prior)) => current - prior,
                                                    _ => 0.0,
                                                };
                                                let delta_text = if current.is_some() && prior.is_some() {
                                                    format_delta(delta, ui_state.language)
                                                } else {
                                                    "—".to_string()
                                                };
                                                let delta_class = if delta.abs() < 0.005 {
                                                    "flat"
                                                } else if delta > 0.0 {
                                                    "up"
                                                } else {
                                                    "down"
                                                };
                                                let spark_points = trend.iter().rev().take(8).collect::<Vec<_>>();
                                                let spark_points = spark_points.into_iter().rev().collect::<Vec<_>>();
                                                let (min_v, max_v) = spark_points.iter().fold(
                                                    (f64::INFINITY, f64::NEG_INFINITY),
                                                    |(min_v, max_v), point| (min_v.min(point.value), max_v.max(point.value)),
                                                );
                                                let span = (max_v - min_v).max(1.0);
                                                let spark = spark_points.iter().enumerate()
                                                    .map(|(index, point)| {
                                                        let x = if spark_points.len() <= 1 {
                                                            0.0
                                                        } else {
                                                            index as f64 / (spark_points.len() - 1) as f64 * 100.0
                                                        };
                                                        let y = 26.0 - ((point.value - min_v) / span) * 20.0;
                                                        format!("{x:.1},{y:.1}")
                                                    })
                                                    .collect::<Vec<_>>()
                                                    .join(" ");
                                                rsx! {
                                                    article {
                                                        class: "card candidate-card",
                                                        style: "border-top-color: {candidate_color(candidate)};",
                                                        div { class: "card-topline",
                                                            div { class: "name", "{candidate.label()}" }
                                                            span { class: "card-caption", "média {state.avg_window_days}d" }
                                                        }
                                                        div { class: "val", "{format_optional_pct(current)}" }
                                                        div { class: "delta {delta_class}", "{delta_text}" }
                                                        if spark_points.len() >= 2 {
                                                            svg {
                                                                class: "card-spark",
                                                                view_box: "0 0 100 28",
                                                                preserve_aspect_ratio: "none",
                                                                role: "img",
                                                                "aria-label": "Tendência recente de {candidate.label()}",
                                                                polyline {
                                                                    points: "{spark}",
                                                                    style: "--series: {candidate_color(candidate)};",
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

                            section { class: "panel", id: "pollsPanel",
                                div { class: "table-toolbar",
                                    div {
                                        h2 { "{t(ui_state.language, "table")}" }
                                        p { class: "muted", "{table_count} {t(ui_state.language, "rows")}" }
                                    }
                                    input {
                                        r#type: "search",
                                        value: "{ui_state.table_query}",
                                        placeholder: "{t(ui_state.language, "search-table")}",
                                        "aria-label": t(ui_state.language, "search-table"),
                                        oninput: move |event| ui.write().table_query = event.value(),
                                    }
                                }
                                p { class: "muted", "{t(ui_state.language, "table-sample")}" }
                                div { class: "table-wrap",
                                    table {
                                        thead { tr {
                                            th { "{t(ui_state.language, "fieldwork")}" }
                                            th { "{t(ui_state.language, "institute")}" }
                                            th { "{t(ui_state.language, "geo")}" }
                                            th { "{t(ui_state.language, "scenario")}" }
                                            th { "TSE" }
                                            for candidate in Candidate::all().iter().copied() {
                                                if state.round == 2 && candidate != Candidate::Lula && candidate != Candidate::Flavio {
                                                } else {
                                                    th { class: "num", "{candidate.label()}" }
                                                }
                                            }
                                            th { class: "num", "N" }
                                            th { "Margem" }
                                            th { "Fonte" }
                                        }}
                                        tbody {
                                            for table_poll in table_polls.iter() {
                                                if let Some(first) = table_poll.rows.first() {
                                                    tr {
                                                        td { "{format_date(&first.fieldwork_end)}" }
                                                        td { "{first.institute}" }
                                                        td { "{first.geo}" }
                                                        td { "{first.scenario}" }
                                                        td { "{first.tse_registration.as_deref().unwrap_or("—")}" }
                                                        for candidate in Candidate::all().iter().copied() {
                                                            if state.round == 2 && candidate != Candidate::Lula && candidate != Candidate::Flavio {
                                                            } else {
                                                                td { class: "num",
                                                                    {
                                                                        table_poll.rows.iter()
                                                                            .find(|row| row.candidate_key == candidate.key())
                                                                            .map(|row| format_pct(row.value))
                                                                            .unwrap_or_else(|| "—".to_string())
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        td { class: "num", "{first.n:.0}" }
                                                        td { class: "num", "{first.moe.map(|v| format!("±{v:.2}")).unwrap_or_else(|| "—".into())}" }
                                                        td {
                                                            if !first.source_url.is_empty() {
                                                                a { href: "{first.source_url}", target: "_blank", rel: "noopener noreferrer", "ver" }
                                                            } else {
                                                                "—"
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            match regional_polls.read().as_ref() {
                                Some(Ok(rows)) if !rows.is_empty() => rsx! {
                                    RegionalPanel { polls: rows.clone(), language: ui_state.language }
                                },
                                Some(Err(_)) | Some(Ok(_)) | None => rsx! {},
                            }

                                                        nav { class: "mobile-nav", "aria-label": "Navegação rápida",
                                a { href: "#overview", "⌂ {t(ui_state.language, "dashboard")}" }
                                a { href: "#chartPanel", "⌁ {t(ui_state.language, "chart")}" }
                                a { href: "#cards", "▦ {t(ui_state.language, "summary")}" }
                                a { href: "#pollsPanel", "≡ {t(ui_state.language, "polls")}" }
                                a { href: "#allSourcesPanel", "◎ {t(ui_state.language, "all-sources")}" }
                            }
                            Methodology { language: ui_state.language }
                            footer {
                                p { "{t(ui_state.language, "static-footer")}" }
                            }
                        }
                    }
                }
            }
        }
    }
}



struct MultiSeries {
    candidate: Candidate,
    rows: Vec<Poll>,
    trend: Vec<crate::chart::TrendPoint>,
    uncertainty: Vec<polling_core::UncertaintyPoint>,
    projection: Option<ProjectSurface>,
    overlays: Vec<crate::overlays::OverlayResult>,
}

struct ProjectSurface {
    line: Vec<crate::chart::TrendPoint>,
    band_low: Vec<crate::chart::TrendPoint>,
    band_high: Vec<crate::chart::TrendPoint>,
}

fn poll_filter_for_chart(
    all: &[Poll],
    candidate: Candidate,
    round: u8,
    geo: &str,
    range_days: Option<i64>,
    institutes: &[String],
) -> Vec<Poll> {
    let mut rows: Vec<Poll> = all.iter()
        .filter(|poll| poll.round == round && poll.candidate_key == candidate.key())
        .filter(|poll| geo == "ALL" || poll.geo == geo)
        .filter(|poll| institutes.is_empty() || institutes.iter().any(|name| name == &poll.institute))
        .cloned()
        .collect();
    if let Some(days) = range_days {
        if let Some(max_day) = rows.iter().map(|poll| poll.day).max() {
            let min_day = max_day - days;
            rows.retain(|poll| poll.day >= min_day);
        }
    }
    rows.sort_by_key(|poll| poll.day);
    rows
}

fn to_project_surface_v1(result: polling_core::ProjectionResult) -> Option<ProjectSurface> {
    if !result.ok || result.line.len() < 2 {
        return None;
    }
    Some(ProjectSurface {
        line: result.line.into_iter().map(|point| crate::chart::TrendPoint {
            day: (point.x / 86_400_000.0).round() as i64,
            value: point.y,
        }).collect(),
        band_low: result.band_low.into_iter().map(|point| crate::chart::TrendPoint {
            day: (point.x / 86_400_000.0).round() as i64,
            value: point.y,
        }).collect(),
        band_high: result.band_high.into_iter().map(|point| crate::chart::TrendPoint {
            day: (point.x / 86_400_000.0).round() as i64,
            value: point.y,
        }).collect(),
    })
}

fn to_project_surface_v2(result: &ProjectionV2Result) -> Option<ProjectSurface> {
    if !result.ok || result.line.len() < 2 {
        return None;
    }
    Some(ProjectSurface {
        line: result.line.iter().map(|point| crate::chart::TrendPoint {
            day: (point.x / 86_400_000.0).round() as i64,
            value: point.y,
        }).collect(),
        band_low: result.band_low.iter().map(|point| crate::chart::TrendPoint {
            day: (point.x / 86_400_000.0).round() as i64,
            value: point.y,
        }).collect(),
        band_high: result.band_high.iter().map(|point| crate::chart::TrendPoint {
            day: (point.x / 86_400_000.0).round() as i64,
            value: point.y,
        }).collect(),
    })
}

fn multi_chart_svg(
    all: &[Poll],
    round: u8,
    geo: &str,
    range_days: Option<i64>,
    institutes: &[String],
    model: u8,
    avg_window_days: f64,
    hidden_candidates: &[String],
    overlay_ids: &[String],
    hover_day: Option<i64>,
    mut view: Signal<ViewState>,
) -> Element {
    let keys: Vec<Candidate> = if round == 2 {
        vec![Candidate::Lula, Candidate::Flavio, Candidate::BrancoNulo]
    } else {
        Candidate::all().to_vec()
    };

    let mut surfaces = Vec::new();
    let mut observed_min = i64::MAX;
    let mut observed_max = i64::MIN;
    let mut low = 0.0_f64;
    let mut high = 0.0_f64;

    for candidate in keys.iter().copied() {
        let rows = poll_filter_for_chart(all, candidate, round, geo, range_days, institutes);
        if let Some(day) = rows.first().map(|poll| poll.day) {
            observed_min = observed_min.min(day);
        }
        if let Some(day) = rows.last().map(|poll| poll.day) {
            observed_max = observed_max.max(day);
        }
        let trend = trend_for_model(&rows, avg_window_days, model);
        for poll in &rows {
            low = low.min(poll.value);
            high = high.max(poll.value);
        }
        for point in &trend {
            low = low.min(point.value);
            high = high.max(point.value);
        }

        let uncertainty_rows: Vec<PollObservation> = rows.iter().map(|row| PollObservation {
            t: row.day as f64 * 86_400_000.0,
            y: row.value,
            n: Some(row.n),
            institute: Some(row.institute.clone()),
            moe: row.moe,
        }).collect();

        let uncertainty = uncertainty_band(&uncertainty_rows, avg_window_days, 1.645);
        for point in &uncertainty {
            low = low.min(point.low);
            high = high.max(point.high);
        }

        let projection = if model == 1 {
            let points: Vec<crate::chart::TrendPoint> = trend.iter().map(|point| point.clone()).collect();
            to_project_surface_v1(project_trend(
                &points.iter().map(|point| polling_core::SeriesPoint { x: point.day as f64 * 86_400_000.0, y: point.value }).collect::<Vec<_>>(),
                avg_window_days as f64,
                14,
                if round == 2 { Some(ELECTION_ROUND2_MS) } else { Some(ELECTION_ROUND1_MS) },
                4,
                0.25,
                10.0,
                1.645,
                2.0,
                0.12,
            ))
        } else if model == 2 {
            to_project_surface_v2(&projection_v2_for_round(&rows, round))
        } else {
            None
        };

        if let Some(proj) = projection.as_ref() {
            if let Some(point) = proj.line.last() {
                observed_max = observed_max.max(point.day);
                low = low.min(point.value);
                high = high.max(point.value);
            }
            for point in proj.band_low.iter().chain(proj.band_high.iter()) {
                low = low.min(point.value);
                high = high.max(point.value);
            }
        }

        let overlays = overlay_ids.iter()
            .filter_map(|id| {
                let result = compute_overlay(id, &trend, &rows);
                if result.mid.is_empty() && result.high.is_empty() {
                    None
                } else {
                    Some(result)
                }
            })
            .collect();

        surfaces.push(MultiSeries {
            candidate,
            rows,
            trend,
            uncertainty,
            projection,
            overlays,
        });
    }

    if observed_min == i64::MAX || observed_max == i64::MIN {
        return rsx! { div { class: "chart-empty muted", "Sem dados para o gráfico." } };
    }

    let base_min_day = observed_min as f64;
    let base_max_day = observed_max as f64;
    let projection_extra = if model > 0 { 15.0 } else { 1.5 };
    let mut chart_max_day = base_max_day + projection_extra;
    if let Some(days) = range_days {
        let min = base_max_day - days as f64;
        chart_max_day = base_max_day + projection_extra;
        let base_min_candidate = base_min_day.max(min);
        // Keep the range aligned to the requested observation window.
        let _ = base_min_candidate;
    }
    let range_min_day = match range_days {
        Some(days) => base_max_day.max(base_min_day) - days as f64,
        None => base_min_day,
    }.max(base_min_day);

    let mut y_low = low.max(0.0);
    let mut y_high = high.max(50.0);
    let span = (y_high - y_low).max(if round == 2 { 8.0 } else { 20.0 });
    let pad = (span * 0.08).max(2.0);
    y_low = (y_low - pad).max(0.0);
    y_high = (y_high + pad).min(100.0).max(y_low + 5.0);

    let current = view();
    let (min_day, max_day) = navigation_window(
        range_min_day,
        chart_max_day,
        current.zoom,
        current.pan_days,
    );

    let width = crate::chart::WIDTH - LEFT - RIGHT;
    let y_for_value = |value: f64| -> f64 { TOP + (1.0 - (value - y_low) / (y_high - y_low).max(1.0)) * (HEIGHT - TOP - BOTTOM) };
    let x_for_day = |day: i64| -> f64 { LEFT + ((day as f64 - min_day) / (max_day - min_day).max(1.0)).clamp(0.0, 1.0) * width };
    let day_for_x = |x: f64| -> i64 {
        (min_day + ((x - LEFT) / width.max(1.0)).clamp(0.0, 1.0) * (max_day - min_day)).round() as i64
    };

    let y_ticks = (0..=5).map(|i| {
        let frac = i as f64 / 5.0;
        let value = y_high - frac * (y_high - y_low);
        (value, y_for_value(value))
    }).collect::<Vec<_>>();
    let x_ticks = (0..=6).map(|i| {
        let frac = i as f64 / 6.0;
        let day = min_day + frac * (max_day - min_day);
        (LEFT + frac * width, format_day_axis(day))
    }).collect::<Vec<_>>();

    let hover_rows: Vec<(&MultiSeries, &Poll)> = if let Some(day) = hover_day {
        surfaces.iter()
            .filter(|surface| !hidden_candidates.iter().any(|key| key == surface.candidate.key()))
            .filter_map(|surface| {
                let poll = surface.rows.iter().min_by_key(|poll| (poll.day - day).abs())?;
                Some((surface, poll))
            })
            .collect()
    } else {
        Vec::new()
    };

    rsx! {
        div {
            class: "multi-chart",
            svg {
                class: "chart",
                view_box: "0 0 1100 470",
                onmousemove: move |event| {
                    let x = event.data().element_coordinates().x;
                    let clamped = x.clamp(LEFT, LEFT + width);
                    view.write().hover_day = Some(day_for_x(clamped));
                },
                onmouseleave: move |_| {
                    view.write().hover_day = None;
                },
                onwheel: move |event| {
                    event.prevent_default();
                    let data = event.data();
                    let x = data.element_coordinates().x.clamp(LEFT, LEFT + width);
                    let delta_y = data.delta().strip_units().y;
                    if delta_y.abs() < 0.01 { return; }
                    let mut state = view.write();
                    let (zoom, pan_days) = zoom_around(
                        range_min_day,
                        chart_max_day,
                        state.zoom,
                        state.pan_days,
                        x,
                        delta_y,
                    );
                    state.zoom = zoom;
                    state.pan_days = pan_days;
                    state.hover_day = Some(day_for_x(x));
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
                        let (distance, midpoint_x) = pinch_geometry(Some(a), Some(b)).unwrap_or((0.0, (a.1 + b.1) / 2.0));
                        if distance > 1.0 {
                            if let Some((last_distance, last_midpoint_x)) = state.pinch_last {
                                let old_zoom = state.zoom;
                                let (old_min, old_max) = navigation_window(range_min_day, chart_max_day, old_zoom, state.pan_days);
                                let anchor_day = day_from_x(last_midpoint_x, old_min, old_max);
                                let ratio = (distance / last_distance).clamp(0.85, 1.18);
                                let new_zoom = (old_zoom * ratio).clamp(1.0, MAX_ZOOM);
                                state.pan_days = pan_to_anchor(range_min_day, chart_max_day, new_zoom, anchor_day, midpoint_x);
                                state.zoom = new_zoom;
                            }
                            state.pinch_last = Some((distance, midpoint_x));
                        }
                    } else if let Some((start_id, start_x, start_pan)) = state.pan_start {
                        if start_id == id {
                            state.pan_days = pan_by_pixels(range_min_day, chart_max_day, state.zoom, start_pan, x - start_x);
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
                "aria-label": "Gráfico customizado de pesquisas eleitorais por candidato",
                width: "1100",
                height: "{HEIGHT}",
                rect { x: "0", y: "0", width: "1100", height: "{HEIGHT}", fill: "var(--chart-bg, #0d1117)" }

                for (value, y) in y_ticks.iter().copied() {
                    line { class: "grid-line", x1: "{LEFT}", x2: "{1100.0 - RIGHT}", y1: "{y:.2}", y2: "{y:.2}" }
                    text { class: "axis-label", x: "8", y: "{y + 4.0:.2}", "{value:.1}%" }
                }
                for (x, label) in x_ticks.iter() {
                    line { class: "grid-line", x1: "{x:.2}", x2: "{x:.2}", y1: "{TOP}", y2: "{HEIGHT - BOTTOM}" }
                    text { class: "axis-label", x: "{x - 17.0:.2}", y: "{HEIGHT - 17.0:.2}", "{label}" }
                }

                for surface in surfaces.iter() {
                    if !hidden_candidates.iter().any(|key| key == surface.candidate.key()) {
                        {
                            let color = candidate_color(surface.candidate);
                            let poll_points = surface.rows.iter()
                                .map(|poll| format!("{:.2},{:.2}", x_for_day(poll.day), y_for_value(poll.value)))
                                .collect::<Vec<_>>().join(" ");
                            let trend_path = surface.trend.iter()
                                .map(|point| format!("{:.2},{:.2}", x_for_day(point.day), y_for_value(point.value)))
                                .collect::<Vec<_>>().join(" ");
                            let band_points = {
                                let mut pts = surface.uncertainty.iter().map(|p| format!("{:.2},{:.2}", x_for_day((p.x/86_400_000.0).round() as i64), y_for_value(p.low))).collect::<Vec<_>>();
                                pts.extend(surface.uncertainty.iter().rev().map(|p| format!("{:.2},{:.2}", x_for_day((p.x/86_400_000.0).round() as i64), y_for_value(p.high))));
                                pts.join(" ")
                            };
                            let projection_points = surface.projection.as_ref().map(|p| p.line.iter().map(|point| format!("{:.2},{:.2}", x_for_day(point.day), y_for_value(point.value))).collect::<Vec<_>>().join(" ")).unwrap_or_default();
                            let projection_band = surface.projection.as_ref().map(|p| {
                                let mut pts = p.band_low.iter().map(|point| format!("{:.2},{:.2}", x_for_day(point.day), y_for_value(point.value))).collect::<Vec<_>>();
                                pts.extend(p.band_high.iter().rev().map(|point| format!("{:.2},{:.2}", x_for_day(point.day), y_for_value(point.value))));
                                pts.join(" ")
                            }).unwrap_or_default();

                            rsx! {
                                if !band_points.is_empty() {
                                    polygon { class: "uncertainty-band", points: "{band_points}", style: "fill: {color};" }
                                }
                                if !trend_path.is_empty() {
                                    polyline { class: "series-line", points: "{trend_path}", style: "--series: {color};" }
                                }
                                for poll in surface.rows.iter() {
                                    circle {
                                        class: "poll-point",
                                        cx: "{x_for_day(poll.day):.2}",
                                        cy: "{y_for_value(poll.value):.2}",
                                        r: "4",
                                        style: "fill: var(--surface); stroke: {color};",
                                    }
                                }
                                if let Some(projection) = surface.projection.as_ref() {
                                    if !projection_band.is_empty() {
                                        polygon { class: "projection-band", points: "{projection_band}", style: "fill: {color};" }
                                    }
                                    if !projection_points.is_empty() {
                                        polyline { class: "projection-line", points: "{projection_points}", style: "stroke: {color};" }
                                    }
                                }
                                for overlay in surface.overlays.iter() {
                                    {
                                        let overlay_path = overlay.mid.iter()
                                            .map(|point| format!("{:.2},{:.2}", x_for_day(point.day), y_for_value(point.value)))
                                            .collect::<Vec<_>>().join(" ");
                                        if !overlay_path.is_empty() {
                                            polyline {
                                                class: "overlay-line",
                                                points: "{overlay_path}",
                                                style: "--series: {color};"
                                            }
                                        }
                                        if !overlay.high.is_empty() {
                                            let mut pts = overlay.high.iter().map(|point| format!("{:.2},{:.2}", x_for_day(point.day), y_for_value(point.value))).collect::<Vec<_>>();
                                            pts.extend(overlay.low.iter().rev().map(|point| format!("{:.2},{:.2}", x_for_day(point.day), y_for_value(point.value))));
                                            polygon { class: "overlay-band", points: "{pts.join(" ")}", style: "fill: {color};" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if let Some(day) = hover_day {
                    let x = x_for_day(day);
                    line { class: "hover-crosshair", x1: "{x:.2}", x2: "{x:.2}", y1: "{TOP}", y2: "{HEIGHT - BOTTOM}" }
                }
            }

            if !hover_rows.is_empty() {
                div { class: "chart-hover",
                    span { class: "ch-date", "{format_date_from_day(hover_day.unwrap_or(observed_max))}" }
                    for (surface, poll) in hover_rows.iter().take(8) {
                        span { class: "ch-row",
                            i { style: "background: {candidate_color(surface.candidate)};" }
                            "{surface.candidate.label()}: {format_pct(poll.value)} · {poll.institute}"
                        }
                    }
                }
            } else {
                div { class: "chart-hover is-empty", "Toque um ponto — a leitura aparece aqui, não em cima do gráfico." }
            }
        }
    }
}

fn chart_svg(rows: &[Poll], trend: &[crate::chart::TrendPoint], projection: Option<&ProjectionV2Result>, hover_day: Option<i64>, avg_window_days: f64, language: Language, mut view: Signal<ViewState>) -> Element {
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
    let uncertainty = uncertainty_band(&uncertainty_rows, avg_window_days, 1.645);
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
                    let (distance, midpoint_x) = pinch_geometry(Some(a), Some(b)).unwrap_or((0.0, (a.1 + b.1) / 2.0));
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

fn projection_status_text(projection: Option<&ProjectionV2Result>, language: Language) -> String {
    match projection {
        Some(proj) if proj.ok => {
            let steps = (proj.horizon_used.min(10) as usize).min(proj.line.len().saturating_sub(1));
            if steps == 0 {
                return if matches!(language, Language::En) {
                    "Projection v2 is available, but no usable future horizon was found.".to_string()
                } else {
                    "Projeção v2 disponível, sem horizonte futuro utilizável.".to_string()
                };
            }
            let delta = proj.line[steps].y - proj.line[0].y;
            let delta_text = format!("{delta:+.1}").replace('.', ",");
            match proj.holdout.as_ref() {
                Some(gate) => if matches!(language, Language::En) {
                    format!(
                        "Projection v2: {delta_text} pp/{steps}d · holdout RMSE model {:.2} vs persistence {:.2}.",
                        gate.rmse_model.unwrap_or(f64::NAN),
                        gate.rmse_persist.unwrap_or(f64::NAN),
                    )
                } else {
                    format!(
                        "Projeção v2: {delta_text} pp/{steps}d · holdout RMSE modelo {:.2} vs persistência {:.2}.",
                        gate.rmse_model.unwrap_or(f64::NAN),
                        gate.rmse_persist.unwrap_or(f64::NAN),
                    )
                },
                None => if matches!(language, Language::En) {
                    format!("Projection v2: {delta_text} pp/{steps}d.")
                } else {
                    format!("Projeção v2: {delta_text} pp/{steps}d.")
                },
            }
        }
        Some(proj) => {
            if matches!(language, Language::En) {
                format!(
                    "Projection v2 unavailable: {}.",
                    proj.reason.as_deref().unwrap_or("reason not provided"),
                )
            } else {
                format!(
                    "Projeção v2 indisponível: {}.",
                    proj.reason.as_deref().unwrap_or("motivo não informado"),
                )
            }
        }
        None => if matches!(language, Language::En) {
            "Projection v2 unavailable: no data.".to_string()
        } else {
            "Projeção v2 indisponível: sem dados.".to_string()
        },
    }
}

fn format_meta_date(value: &str) -> String {
    format_date(value)
}

fn format_meta_stamp(value: &str) -> String {
    if value.len() >= 16 {
        value.replace('T', " ").chars().take(16).collect()
    } else {
        value.to_string()
    }
}

fn candidate_color(candidate: Candidate) -> &'static str {
    match candidate {
        Candidate::Lula => "#c62828",
        Candidate::Flavio => "#009c3b",
        Candidate::Cury => "#b45309",
        Candidate::Renan => "#6d28d9",
        Candidate::Caiado => "#4d7c0f",
        Candidate::Zema => "#ea580c",
        Candidate::Samara => "#0284c7",
        Candidate::Hertz => "#475569",
        Candidate::Edmilson => "#9f1239",
        Candidate::Rui => "#0f766e",
        Candidate::Clariana => "#7c3aed",
        Candidate::Grassi => "#57534e",
        Candidate::BrancoNulo => "#94a3b8",
    }
}

fn nearest_trend_value(trend: &[crate::chart::TrendPoint], day: i64) -> Option<f64> {
    trend.iter()
        .min_by_key(|point| (point.day - day).abs())
        .map(|point| point.value)
}

fn format_optional_pct(value: Option<f64>) -> String {
    value.map(format_pct).unwrap_or_else(|| "—".to_string())
}

fn format_delta(value: f64, language: Language) -> String {
    let rounded = (value * 100.0).round() / 100.0;
    if rounded.abs() < 0.005 {
        return if matches!(language, Language::En) {
            "0.00 pp vs 30d".to_string()
        } else {
            "0,00 pp vs 30d".to_string()
        };
    }
    let decimal = format!("{rounded:+.2}").replace('.', if matches!(language, Language::En) { "." } else { "," });
    if matches!(language, Language::En) {
        format!("{decimal} pp vs 30d")
    } else {
        format!("{decimal} pp vs 30d")
    }
}

fn group_polls_by_id(rows: &[Poll]) -> Vec<TablePoll> {
    let mut grouped = std::collections::BTreeMap::<String, Vec<Poll>>::new();
    for row in rows {
        grouped.entry(row.id.clone()).or_default().push(row.clone());
    }
    let mut out: Vec<TablePoll> = grouped.into_values()
        .map(|mut rows| {
            rows.sort_by(|a, b| a.candidate_key.cmp(&b.candidate_key));
            TablePoll { rows }
        })
        .collect();
    out.sort_by(|a, b| {
        let ad = a.rows.first().map(|row| row.day).unwrap_or(i64::MIN);
        let bd = b.rows.first().map(|row| row.day).unwrap_or(i64::MIN);
        bd.cmp(&ad)
    });
    out
}

fn unique_poll_count(rows: &[Poll], round: Option<u8>) -> usize {
    let mut ids = BTreeSet::new();
    for row in rows {
        if round.map(|wanted| row.round == wanted).unwrap_or(true) {
            ids.insert(row.id.clone());
        }
    }
    ids.len()
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


#[cfg(test)]
mod navigation_tests {
    use super::*;

    #[test]
    fn navigation_window_zooms_around_the_base_center() {
        let (min_day, max_day) = navigation_window(0.0, 100.0, 2.0, 0.0);
        assert!((min_day - 25.0).abs() < 1e-9);
        assert!((max_day - 75.0).abs() < 1e-9);
    }

    #[test]
    fn navigation_pan_is_clamped_to_the_visible_base_range() {
        let pan = pan_by_pixels(0.0, 100.0, 2.0, 0.0, 10_000.0);
        assert!((pan + 25.0).abs() < 1e-9);
    }

    #[test]
    fn wheel_zoom_preserves_cursor_anchor() {
        let x = LEFT + (1100.0 - LEFT - RIGHT) / 2.0;
        let (zoom, pan) = zoom_around(0.0, 100.0, 1.0, 0.0, x, -700.0);
        assert!(zoom > 1.0);
        assert!(pan.abs() < 1e-9);
    }
}
