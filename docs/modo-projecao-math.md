# Modo projeção — especificação matemática (Projection Math)

**Status:** recomendação v1 para o site  
**Princípio:** honestidade > curvas impressionantes. Projeção = estimativa de modelo sobre a *média ponderada*, nunca fato, nunca “quem vence”.

**Calendário (contexto):** 1º turno 4/10/2026; eventual 2º 25/10/2026 (TSE). Horizonte deve parar no turno em vista.

---

## 1. Métodos de agregadores sérios (adequação ao JS no cliente)

| Método | O que faz | Projeta adiante? | JS cliente? | Citação |
|--------|-----------|------------------|-------------|---------|
| **Média ponderada / EWMA** (538 ABC) | Peso por recência (exponencial), amostra, hard stop | Não — descreve o *agora* | Sim (já no site) | [How (most of) our polling averages work](https://abcnews.com/538/polling-averages-work/story?id=109364028) |
| **Regressão polinomial local / LOESS** (Silver Bulletin) | Suaviza a série; média atual deve prever a *próxima* pesquisa | Suaviza; não é forecast de urna | Possível mas pesado | [Silver Bulletin polling average methodology](https://www.natesilver.net/p/silver-bulletin-polling-average-methodology) |
| **House effects Bayesianos / iterativos** (538 / Silver) | Ajusta viés sistemático do instituto vs curva | Melhora a média, não “quem ganha” | Fase 2 (iterativo) | Idem + [NYT/538 house effects 2012](https://archive.nytimes.com/fivethirtyeight.blogs.nytimes.com/2012/06/22/calculating-house-effects-of-polling-firms/) |
| **Modelo Bayesiano dinâmico + fundamentals** (The Economist / Linzer) | Prior + random walk até o dia da eleição + MCMC | Sim — probabilidade de vitória | **Não** (Stan/R) | [Economist how-this-works](https://projects.economist.com/us-2020-forecast/president/how-this-works), [GitHub us-potus-model](https://github.com/TheEconomist/us-potus-model/), [Linzer 2013](https://votamatic.org/wp-content/uploads/2013/07/Linzer-JASA13.pdf) |
| **Forecast Silver Bulletin / 538 clássico** | Média sofisticada + simulações + fundamentals | Sim — P(win) | **Não** no cliente | [Model methodology 2024](https://www.natesilver.net/p/model-methodology-2024) |
| **Tendência linear local + banda** (recomendado v1) | OLS na janela recente da *média*; amortece a frente | Sim, mas só “se a tendência recente continuar (amortecida)” | Sim | Prática padrão de extrapolação com incerteza; alinhada ao espírito “média ≠ forecast” |

**Recomendação v1 (este site):**  
1. **Primário:** tendência linear local **amortecida** sobre a série já produzida por `weightedTrend` (peso √(n/2000)×exp(−dias/janela)), com bandas que alargam.  
2. **Não fazer v1:** Stan/MCMC, P(vitória), fundamentals econômicos, house effects obrigatórios.  
3. **Fase 2 opcional:** house effects encolhidos (shrinkage) se houver ≥3 institutos com sobreposição.

Por quê: o site já tem média honesta; o usuário pediu um *toggle* de projeção leve. Economist/Silver forecast são produtos de servidor. Linear amortecida + bandas largas é o máximo que dá para defender em pt-BR sem mentir.

---

## 2. Fórmulas e parâmetros

### Entrada
Série diária \( \{(t_i, y_i)\} \) = saída de `weightedTrend` para um candidato (ou cenário), \( y \) em pontos percentuais.

### Janela de ajuste
- `fitDays` = janela da média do UI (padrão **14**, clamp **7–28**).
- Usar pontos com \( t \ge t_{\mathrm{last}} - \texttt{fitDays} \).
- Exigir `n ≥ minPoints` (**4**). Se falhar → **não projetar** (toggle pode ficar on, mas sem curva).

### Ajuste OLS
Com \( \tau_i = (t_i - t_0)/\mathrm{dayMs} \) (dias desde o primeiro ponto da janela):

\[
\hat b = \frac{n\sum \tau y - (\sum\tau)(\sum y)}{n\sum\tau^2 - (\sum\tau)^2}, \quad
\hat a = \bar y - \hat b\,\bar\tau
\]

- Se denominador ≈ 0 → \( \hat b = 0 \).
- **Cap de inclinação:** \( \hat b \leftarrow \mathrm{clip}(\hat b, -\texttt{maxAbsSlope}, +\texttt{maxAbsSlope}) \) com `maxAbsSlope = 0.25` pp/dia (~7,5 pp em 30 dias — já agressivo; preferir honestidade).

### Projeção amortecida (não linear pura)
Partir do último ponto observado da média \( (t_L, y_L) \). Para horizonte \( d = 1..H \):

\[
\Delta(d) = \hat b \cdot \lambda \cdot \bigl(1 - e^{-d/\lambda}\bigr)
\]

\[
\hat y(d) = \mathrm{clip}\bigl(y_L + \Delta(d),\; 0,\; 100\bigr)
\]

- `lambda` (`dampTauDays`) = **10** (a tendência “esfria”; evita reta infinita).
- Equivale a uma tendência que satura em \( \hat b\cdot\lambda \) pp no longo prazo.

### Horizonte
- `horizonDays` padrão **14**.
- `H = min(horizonDays, max(0, daysUntilElectionDay))`.
- Para 1º turno: `electionDay = 2026-10-04`; para 2º: `2026-10-25` se o toggle estiver no cenário de 2º.
- **Nunca** estender além do turno em vista sem rótulo explícito.

### Bandas de incerteza (estimativa, não IC clássico garantido)
RMSE dos resíduos na janela:

\[
\mathrm{rmse} = \sqrt{\frac{1}{\max(1,n-2)}\sum (y_i - (\hat a + \hat b\tau_i))^2}
\]

Para cada dia \( d \):

\[
w(d) = z\cdot\sqrt{\mathrm{rmse}^2\cdot\bigl(1 + \tfrac{d}{\texttt{fitDays}}\bigr) + \sigma_0^2 + \sigma_p^2\cdot d}
\]

- `z = 1.645` (~90%, alinhado ao discurso de bandas do Silver Bulletin: “onde caem ~90% das novas pesquisas” — aqui adaptado à projeção).
- `σ0 = bandFloor = 2.0` pp (piso de erro amostral + não amostral típico).
- `σp = processSd = 0.12` pp/√dia (deriva de opinião / erro de modelo).
- Banda: \([\hat y-w,\; \hat y+w]\) clipada em [0, 100].

### House effects (opcional, OFF por padrão)
Para instituto \( h \), residual médio vs média no mesmo dia, com shrinkage:

\[
\hat\delta_h = \frac{N_h}{N_h + \nu}\cdot \overline{(y_{h,i} - \bar y_i)},\quad \nu = 2000
\]

Ajustar pontos antes da média: \( y' = y - \hat\delta_h \). Só ligar se ≥3 institutos com ≥2 pesquisas cada. **Não** é necessário para o toggle v1.

### Defaults resumidos
| Param | Valor |
|-------|-------|
| fitDays | = janela UI (14) |
| minPoints | 4 |
| maxAbsSlope | 0.25 pp/dia |
| dampTauDays | 10 |
| horizonDays | 14 (cap no dia do turno) |
| z | 1.645 |
| bandFloor | 2.0 |
| processSd | 0.12 |
| houseEffects | false |

---

## 3. O que NÃO reivindicar

- Não dizer que um candidato “vai ganhar”, “está eleito”, “vira favorito pela projeção”.
- Não chamar a curva de “pesquisa”, “resultado”, “apuração” ou “previsão oficial”.
- Não publicar probabilidade de vitória (P(win)) sem modelo de urna + erro histórico (fora de escopo).
- Não projetar além do turno sem deixar isso óbvio.
- Não esconder a banda: projeção sem incerteza é propaganda visual.
- Não inventar pontos de pesquisa; só usar a média já calculada a partir de `polls.json` verificado.
- Cartões/números “atuais” devem continuar sendo a **média ponderada observada**, não o ponto final da projeção.

---

## 4. Copy pt-BR (UI)

**Toggle (label):** `Modo projeção`  
**Toggle (aria):** `Ativar extrapolação da tendência recente da média (estimativa de modelo)`  
**Estado on (chip curto):** `Projeção ligada`  
**Hint sob o gráfico (quando on):**  
`Linha tracejada = extrapolação amortecida da média ponderada recente, não uma pesquisa nova. A faixa indica incerteza do modelo (estimativa). Não é prognóstico de urna nem probabilidade de vitória.`

**Disclaimer fixo (metodologia / modal):**  
`O Modo projeção estende a tendência recente da nossa média ponderada por poucos dias, com amortecimento e faixa de incerteza. É uma estimativa de modelo a partir de pesquisas já publicadas — não prevê o resultado da eleição e não substitui as pesquisas.`

**Quando desabilitado por dados insuficientes:**  
`Projeção indisponível: poucas pesquisas recentes nesta série.`

**Legenda da série:** `Nome (projeção)` — manter; evitar `previsão` / `forecast`.

---

## 5. Pseudocódigo / API JS (`src/projection.js`)

Ver implementação em `src/projection.js` (`projectTrend`).

```
projectTrend(series, {
  fitDays, horizonDays, electionDayMs,
  minPoints, maxAbsSlope, dampTauDays,
  z, bandFloor, processSd
}) → {
  ok, reason?,
  line: [{x,y}], bandLow, bandHigh,
  lastObserved, slope, rmse, horizonUsed
}
```

Integração (Frontend): `projection: true` em `createPollChart` / `updatePollChart`; toggle em `main.js`; cartões **não** usam o extremo da projeção.

---

## Addenda (pesquisa complementar)

Confirma a escolha v1. Distinção crítica (538): média = opinião *agora*, não previsão de urna — ver [ABC/538 caution](https://abcnews.com/538/trump-leads-swing-state-polls-tied-biden-nationally/story?id=109506070). Jackman rotula a extrapolação como **projeção da média das pesquisas**, não do resultado: [Voice poll averaging](https://simonjackman.github.io/poll_averaging_voice_2023/poll_averaging.html).

| Extra | Nota | JS? | Link |
|-------|------|-----|------|
| POLITICO Poll of Polls (Kalman) | Tendência atual; não simulador de urna | Lite sim | [metodologia](https://www.politico.eu/article/how-politico-poll-of-polls-tracks-polling-trends-across-europe/) |
| HuffPost Pollster | Kalman (≥5 polls) / LOESS; bandas 95% | LOESS sim | [metodologia](https://www.huffpost.com/entry/huffpost-pollster-poll-averages-methodology_n_57d1a3b2e4b06a74c9f361cb) |
| Fred Cornell (UK) | `exp(−ln2·d/14)·√(n/1000)` — primo do nosso peso; “not a prediction” | Sim | [methodology](https://fredcornell.com/methodology) |
| Poder360 | MA 60d (antes *e* depois) — **não** usar centered MA na ponta ao vivo (vaza futuro) | N/A | [agregador](https://www.poder360.com.br/pesquisas/agregador-de-pesquisas-acompanhe-as-curvas-de-lula-e-bolsonaro/) |
| agregR (BR) | Stan SSM Brasil | Não no cliente | [rnmag/agregR](https://github.com/rnmag/agregR) |

**Desligar projeção também se:** última pesquisa bruta do cenário > **21** dias (checagem no Frontend com `polls`, não só na série diária); mudança de cenário/candidatos nos últimos 7 dias (reset de slope); misturar 1º e 2º turno.

**Disclaimer Poder360 (padrão BR):** “O gráfico acima não tem a finalidade de prever resultados eleitorais, mas de mostrar o comportamento dos dados ao longo do tempo.”
