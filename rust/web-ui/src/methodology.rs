use dioxus::prelude::*;

use crate::chart::MODEL_OPTIONS;
use crate::ui::Language;

fn text(en: bool, pt: &'static str, english: &'static str) -> &'static str {
    if en { english } else { pt }
}

#[component]
pub fn Methodology(language: Language) -> Element {
    let en = matches!(language, Language::En);

    rsx! {
        section { class: "panel metodologia", id: "methodology",
            h2 { {text(en, "Como este site funciona (explicação simples)", "How this site works")} }
            p { class: "meto-lead",
                {text(
                    en,
                    "Pense em vários amigos medindo a altura da mesma árvore. Cada um usa uma fita diferente. A gente junta as medidas.",
                    "Think of several friends measuring the same tree. Each uses a different tape. We combine the measurements instead of choosing one voice."
                )}
            }

            h3 { {text(en, "Regras de inclusão e datas", "Inclusion rules and dates")} }
            ul {
                li { strong { {text(en, "Data de campo", "Fieldwork date")} } " — " {text(en, "quando as entrevistas foram realizadas e é a data usada no eixo do gráfico.", "when interviews were conducted and the date used on the chart axis.")} }
                li { strong { {text(en, "Data de publicação", "Publication date")} } " — " {text(en, "quando uma fonte divulgou o levantamento. Ela permanece visível e não cria uma nova pesquisa.", "when the source released the poll. It remains visible and does not create a second poll.")} }
                li { strong { "TSE" } " — " {text(en, "quando identificado, ajuda a reconhecer a mesma pesquisa mesmo que outra fonte a publique depois.", "when identified, it helps recognize the same poll when published by another source.")} }
                li { strong { {text(en, "Gráfico nacional", "National chart")} } " — " {text(en, "somente pesquisas presidenciais nacionais verificadas. Pesquisas estaduais ficam no painel regional.", "only verified national presidential polls. State polls stay in the regional panel.")} }
                li { strong { {text(en, "Faixa de incerteza", "Uncertainty band")} } " — " {text(en, "uma estimativa ao redor do agregado. Não é margem de erro de uma pesquisa nem probabilidade de vitória.", "an estimate around the aggregate. It is not a poll margin of error or a win probability.")} }
            }

            h3 { {text(en, "O que o desenho significa", "What the drawing means")} }
            ul {
                li { strong { "●" } " — " {text(en, "uma pesquisa individual.", "one individual poll.")} }
                li { strong { {text(en, "Linha cheia", "Solid line")} } " — " {text(en, "o agregado dos pontos.", "the aggregate of the points.")} }
                li { strong { {text(en, "Linha tracejada", "Dashed line")} } " — " {text(en, "uma extrapolação limitada do modelo, não um resultado eleitoral.", "a limited model extrapolation, not an election result.")} }
                li { strong { {text(en, "Overlays", "Overlays")} } " — " {text(en, "linhas visuais que não alteram os valores dos cartões.", "visual lines that do not change card values.")} }
            }

            h3 { {text(en, "Por que não olhamos só uma pesquisa", "Why combine polls")} }
            ul {
                li { {text(en, "Um instituto pode medir um pouco alto; outro, um pouco baixo.", "Pollsters can systematically read somewhat high or low.")} }
                li { {text(en, "Amostras maiores pesam mais, mas não decidem sozinhas.", "Larger samples get more weight, but do not decide alone.")} }
                li { {text(en, "Pesquisas mais antigas pesam menos que as novas.", "Older measurements count less than newer ones.")} }
                li { {text(en, "Repetição da mesma casa recebe redução de peso.", "Repeated polls from the same pollster are down-weighted.")} }
            }

            h3 { {text(en, "Os modos da linha", "Line models")} }
            p { {text(en, "A mesma turma de bolinhas pode ser resumida de formas diferentes. Um modo fica ativo por vez.", "The same poll points can be summarized in different ways. One mode is active at a time.")} }
            div { class: "meto-models",
                for (id, title) in MODEL_OPTIONS.iter().copied() {
                    article {
                        h4 { "{id}" }
                        p { "{title}" }
                        p { {model_description(id, title, en)} }
                    }
                }
            }

            h3 { {text(en, "Réguas visuais", "Visual overlays")} }
            ul {
                for (label, description) in overlay_copy(en) {
                    li { strong { "{label}" } " — " "{description}" }
                }
            }

            h3 { {text(en, "Controles do gráfico", "Chart controls")} }
            ul {
                li { strong { "X" } " — " {text(en, "calendário: esquerda é mais antiga; direita, mais nova.", "calendar: left is older; right is newer.")} }
                li { strong { "Y" } " — " {text(en, "porcentagem de intenção de voto.", "vote-share percentage.")} }
                li { strong { "1d / 3d / 7d / 14d / 21d / 30d / 90d / tudo" } " — " {text(en, "quanto calendário aparece sem apagar pesquisas.", "how much calendar is shown without deleting polls.")} }
                li { strong { "7d / 14d / 30d / 90d / YTD / custom" } " — " {text(en, "até que distância a tendência alcança.", "how far back the trend reaches.")} }
                li { strong { "Roda / pinça / arrastar" } " — " {text(en, "navegação nativa do SVG.", "native SVG navigation.")} }
            }

            h3 { {text(en, "Ferramentas da página", "Page tools")} }
            ul {
                li { strong { {text(en, "Cartões", "Candidate cards")} } " — " {text(en, "estimativa do modelo e diferença contra 30 dias.", "selected-model estimate and 30-day difference.")} }
                li { strong { {text(en, "Filtros", "Pollster filters")} } " — " {text(en, "incluem ou excluem institutos do gráfico e tabela.", "include or exclude pollsters from chart and table.")} }
                li { strong { {text(en, "Tema", "Theme")} } " — " {text(en, "somente visual; não afeta os números.", "visual only; it has no numerical effect.")} }
                li { strong { {text(en, "Atualizar", "Refresh")} } " — " {text(en, "recarrega os dados publicados.", "reloads the published data.")} }
                li { strong { {text(en, "Tabela", "Table")} } " — " {text(en, "lista metadados, amostra, margem, TSE e fonte.", "lists metadata, sample, margin, TSE and source.")} }
            }

            details { class: "meto-more",
                summary { {text(en, "Contas diretas (para quem quiser o detalhe)", "Direct formulas")} }
                ul {
                    li { "Model 1: " code { "weight = √(N/2000) × exp(−days/window)" } }
                    li { "Model 2: " code { "2^(−days/window), repeated-house down-weighting, house-effect correction" } }
                    li { {text(en, "Models 3–12 use the shared Rust advanced-model dispatcher and parity fixtures.", "Os modelos 3–12 usam o dispatcher avançado Rust compartilhado e fixtures de paridade.")} }
                }
                p {
                    {text(en, "Long-form documentation: ", "Texto longo: ")}
                    a { href: "https://github.com/Gitdisd/pesquisas-eleitorais-br/blob/main/docs/MODELS.md", target: "_blank", rel: "noopener noreferrer", "docs/MODELS.md" }
                }
            }

            p { class: "meto-foot", {text(en, "Site estático, sem fins partidários.", "Static, non-partisan site.")} }
        }
    }
}

fn model_description(id: u8, _title: &str, en: bool) -> &'static str {
    match id {
        0 => text(en, "Bolinha + linha sem extrapolação.", "Individual points without extrapolation."),
        1 => text(en, "Regra canônica: pesquisa grande e nova pesa mais.", "Canonical rule: larger and newer polls weigh more."),
        2 => text(en, "Inclui efeito de casa e redução de repetição.", "Adds house effect and repeated-house down-weighting."),
        3 => text(en, "Considera incerteza e discordância entre institutos.", "Accounts for uncertainty and pollster disagreement."),
        4 => text(en, "Estado latente atualizado por novas pesquisas.", "Latent state updated by incoming polls."),
        5 => text(en, "Memória curta com ênfase nos pontos recentes.", "Short memory with stronger recent-point emphasis."),
        6 => text(en, "Atualização diária da tendência.", "Daily trend update."),
        7 => text(en, "Ajuste local por instituto.", "Pollster-local adjustment."),
        8 => text(en, "Média aritmética.", "Arithmetic mean."),
        9 => text(en, "Média ponderada pela raiz da amostra.", "Sample-root weighted mean."),
        10 => text(en, "Mediana da distribuição.", "Distribution median."),
        11 => text(en, "Moda em faixas.", "Binned mode."),
        12 => text(en, "Média aparada.", "Trimmed mean."),
        _ => "",
    }
}

fn overlay_copy(en: bool) -> Vec<(&'static str, &'static str)> {
    if en {
        vec![
            ("SMA 7", "simple 7-point moving average."),
            ("SMA 21", "simple 21-point moving average."),
            ("EMA 9", "9-point exponential moving average."),
            ("EMA 21", "21-point exponential moving average."),
            ("HMA 16", "faster weighted moving average."),
            ("VWMA 14", "sample-size weighted moving average."),
            ("KAMA 10", "adaptive moving average."),
            ("Bollinger 20", "midline with a ±2 standard-deviation corridor."),
        ]
    } else {
        vec![
            ("SMA 7", "média móvel simples de 7 pontos."),
            ("SMA 21", "média móvel simples de 21 pontos."),
            ("EMA 9", "média móvel exponencial de 9 pontos."),
            ("EMA 21", "média móvel exponencial de 21 pontos."),
            ("HMA 16", "média móvel ponderada mais rápida."),
            ("VWMA 14", "média móvel ponderada pelo tamanho da amostra."),
            ("KAMA 10", "média móvel adaptativa."),
            ("Bollinger 20", "linha central com corredor de ±2 desvios-padrão."),
        ]
    }
}
