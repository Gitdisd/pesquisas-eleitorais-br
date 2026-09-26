use dioxus::prelude::*;

pub fn Methodology(language: crate::ui::Language) -> Element {
    let en = matches!(language, crate::ui::Language::En);
    rsx! {
        section { class: "panel metodologia", id: "methodology",
            h2 { if en { "How this site works" } else { "Como este site funciona (explicação simples)" } }
            p { class: "meto-lead",
                if en {
                    "Think of several friends measuring the same tree. Each uses a different tape. We combine the measurements instead of choosing one voice."
                } else {
                    "Pense em vários amigos medindo a altura da mesma árvore. Cada um usa uma fita diferente. A gente junta as medidas."
                }
            }

            section { class: "meto-sec",
                h3 { if en { "Inclusion rules and dates" } else { "Regras de inclusão e datas" } }
                ul {
                    li { strong { if en { "Fieldwork date" } else { "Data de campo" } } " — "
                        if en { "when interviews were conducted and the date used on the chart axis." }
                        else { "quando as entrevistas foram realizadas e é a data usada no eixo do gráfico." }
                    }
                    li { strong { if en { "Publication date" } else { "Data de publicação" } } " — "
                        if en { "when the source released the poll. It remains visible and does not create a second poll." }
                        else { "quando uma fonte divulgou o levantamento. Ela permanece visível e não cria uma nova pesquisa." }
                    }
                    li { strong { if en { "TSE registration" } else { "Registro TSE" } } " — "
                        if en { "when identified, it helps recognize the same poll when published by another source." }
                        else { "quando identificado, ajuda a reconhecer a mesma pesquisa mesmo que outra fonte a publique depois." }
                    }
                    li { strong { if en { "National chart" } else { "Gráfico nacional" } } " — "
                        if en { "only verified presidential voting-intention polls in Brazil. State polls stay in the regional panel." }
                        else { "somente pesquisas verificadas de intenção de voto presidencial no Brasil. Pesquisas estaduais ficam no painel regional." }
                    }
                    li { strong { if en { "Uncertainty band" } else { "Faixa de incerteza" } } " — "
                        if en { "an estimate around the aggregate. It is not a poll margin of error or a win probability." }
                        else { "uma estimativa ao redor do agregado. Não é a margem de erro de uma pesquisa e não é probabilidade de vitória." }
                }
            }

            section { class: "meto-sec",
                h3 { if en { "What the drawing means" } else { "O desenho" } }
                ul {
                    li { strong { "●" } " — " if en { "one poll, from one pollster, at that time." } else { "uma pesquisa, daquela casa, naquele período." } }
                    li { strong { if en { "Solid line" } else { "Linha cheia" } } " — " if en { "the aggregate of the points." } else { "o resumo das bolinhas." } }
                    li { strong { if en { "Dashed line" } else { "Linha tracejada" } } " — " if en { "a limited model extrapolation, not an election result." } else { "uma extrapolação limitada do modelo, não o resultado da eleição." } }
                    li { strong { if en { "Overlays" } else { "Linhas extras (overlays)" } } " — " if en { "visual reference lines that do not change card values." } else { "réguas visuais que não mudam os valores dos cartões." } }
                }
            }

            section { class: "meto-sec",
                h3 { if en { "Why combine polls" } else { "Por que não olhamos só uma pesquisa" } }
                ul {
                    li { if en { "Pollsters can systematically read somewhat high or low." } else { "Um instituto pode medir um pouco alto. Outro pode medir um pouco baixo." } }
                    li { if en { "Larger samples get more weight, but do not decide alone." } else { "Quem ouviu mais pessoas pesa mais, mas não manda sozinho." } }
                    li { if en { "Older measurements count less than newer ones." } else { "Medida velha vale menos que medida nova." } }
                    li { if en { "Repeated polls from the same pollster are down-weighted so repetition alone does not dominate." } else { "Pesquisas repetidas da mesma casa recebem menos peso para que repetir não domine o desenho." } }
                }
            }

            section { class: "meto-sec",
                h3 { if en { "Line models" } else { "Os modos da linha" } }
                p { if en { "The same poll points can be summarized in different ways. One mode is active at a time." } else { "É a mesma turma de bolinhas. Muda só o jeito de fazer a média. Um modo de cada vez." } }
                div { class: "meto-models",
                    for (id, title, body) in model_copy(en) {
                        article {
                            h4 { "{title}" }
                            p { "{id}" }
                            p { "{body}" }
                        }
                    }
                }
            }

            section { class: "meto-sec",
                h3 { if en { "Visual overlays" } else { "Réguas (overlays / indicadores)" } }
                p { if en { "They are visual guides over the selected trend. Turning them on or off does not change the headline cards." } else { "São réguas visuais sobre a tendência selecionada. Ligar ou desligar não muda os cartões." } }
                ul {
                    for (label, body) in overlay_copy(en) {
                        li { strong { "{label}" } " — {body}" }
                    }
                }
            }

            section { class: "meto-sec",
                h3 { if en { "Chart controls" } else { "Escalas e botões do gráfico" } }
                ul {
                    li { strong { "X" } " — " if en { "calendar: left is older, right is newer." } else { "calendário: esquerda é passado, direita é mais nova." } }
                    li { strong { "Y" } " — " if en { "vote share percentage." } else { "porcentagem de intenção de voto." } }
                    li { strong { "1d / 3d / 7d / 14d / 21d / 30d / 90d / all" } " — " if en { "how much calendar is shown; it does not delete polls." } else { "quanto calendário aparece; não apaga pesquisas." } }
                    li { strong { "7d / 14d / 30d / 90d / YTD / custom" } " — " if en { "how far back the selected trend reaches." } else { "até que distância a janela da tendência alcança." } }
                    li { strong { "Wheel / pinch / drag" } " — " if en { "native SVG navigation." } else { "navegação nativa do SVG." } }
                }
            }

            section { class: "meto-sec",
                h3 { if en { "Page tools" } else { "Ferramentas da página" } }
                ul {
                    li { strong { if en { "Candidate cards" } else { "Cartões" } } " — " if en { "current selected-model estimate and 30-day difference." } else { "estimativa do modelo selecionado e diferença contra 30 dias." } }
                    li { strong { if en { "Pollster filters" } else { "Filtros de instituto" } } " — " if en { "include or exclude a pollster from the main chart and table." } else { "ligar ou desligar uma casa do gráfico e da tabela." } }
                    li { strong { if en { "Theme" } else { "Tema" } } " — " if en { "visual only; it has no numerical effect." } else { "somente visual; não afeta os números." } }
                    li { strong { if en { "Refresh" } else { "Atualizar" } } " — " if en { "reloads the published data already served by Pages." } else { "recarrega os dados publicados que já estão no ar." } }
                    li { strong { if en { "Table" } else { "Tabela" } } " — " if en { "lists raw poll metadata, sample, margin and source." } else { "lista metadados, amostra, margem e fonte da pesquisa." } }
                }
            }

            details { class: "meto-more",
                summary { if en { "Direct formulas" } else { "Contas diretas (para quem quiser o detalhe)" } }
                ul {
                    li { "Model 1: " code { "weight = √(N/2000) × exp(−days/window)" } }
                    li { "Model 2: " code { "2^(−days/window), repeated-house down-weighting, house effect correction" } }
                    li { "Models 3–12 use the shared Rust advanced-model dispatcher and the same production parity fixtures." }
                }
                p {
                    if en { "Long-form documentation: " }
                    else { "Texto longo: " }
                    a { href: "https://github.com/Gitdisd/pesquisas-eleitorais-br/blob/main/docs/MODELS.md", target: "_blank", rel: "noopener noreferrer", "docs/MODELS.md" }
                }
            }

            p { class: "meto-foot",
                if en { "Static, non-partisan site." } else { "Site estático, sem fins partidários." }
            }
        }
    }
}

fn model_copy(en: bool) -> Vec<(&'static str, &'static str, &'static str)> {
    if en {
        vec![
            ("0", "off", "Individual points without model extrapolation."),
            ("1", "standard", "Large and recent polls weigh more using the canonical production rule."),
            ("2", "house-adjusted", "Adds pollster house-effect adjustment and repeated-house down-weighting."),
            ("3", "Meta", "Accounts for sampling uncertainty and disagreement between pollsters."),
            ("4", "Kalman", "Treats latent intent as a state updated by incoming polls."),
            ("5", "Fast", "Uses a shorter memory and stronger emphasis on recent measurements."),
        ]
    } else {
        vec![
            ("0", "off", "Bolinha + linha sem extrapolação."),
            ("1", "padrão", "Pesquisa grande e nova pesa mais pela regra canônica de produção."),
            ("2", "casa justa", "Inclui ajuste de efeito de casa e redução de repetição do mesmo instituto."),
            ("3", "Meta", "Considera incerteza amostral e discordância entre institutos."),
            ("4", "Kalman", "Trata a intenção latente como um estado atualizado por novas pesquisas."),
            ("5", "Rápido", "Usa memória curta e mais ênfase nas medições recentes."),
        ]
    }
}

fn overlay_copy(en: bool) -> Vec<(&'static str, &'static str)> {
    if en {
        vec![
            ("SMA 7", "simple 7-point moving average."),
            ("SMA 21", "simple 21-point moving average."),
            ("EMA 9 / 21", "exponential moving averages that emphasize newer points."),
            ("HMA 16", "faster weighted moving average."),
            ("VWMA 14", "volume/sample-size weighted moving average."),
            ("KAMA 10", "adaptive moving average that reacts to efficiency in the series."),
            ("Bollinger 20", "a midline with a ±2 standard-deviation visual corridor."),
        ]
    } else {
        vec![
            ("SMA 7", "média móvel simples de 7 pontos."),
            ("SMA 21", "média móvel simples de 21 pontos."),
            ("EMA 9 / 21", "médias exponenciais que dão mais peso aos pontos novos."),
            ("HMA 16", "média móvel ponderada mais rápida."),
            ("VWMA 14", "média móvel ponderada pelo tamanho da amostra."),
            ("KAMA 10", "média adaptativa que reage à eficiência da série."),
            ("Bollinger 20", "linha central com corredor visual de ±2 desvios-padrão."),
        ]
    }
}
