# Modelos da linha (não são prognóstico de urna)

Pontos no gráfico = pesquisas brutas, data = **fim de campo**.
Linha sólida = média do chip ativo. Cartões usam a mesma função.
**Padrão do site = Exp (modelo 1).**
Nenhum modelo publica P(vitória) nem inventa pesquisa.

Código: `src/aggregate.ts` (dispatch + modelos 1–2), `src/models-advanced.js` (3–7), `src/models/school.ts` (8–12).
Overlays visuais: `src/overlays.js` — não alteram a média.
Dispatch: `averageTrend(points, windowDays, model)`.

Chips modelo: off, Exp, Casa, Meta, Kalman, Rápido, Dia, Local.
Chips centro: Média, Peso, Mediana, Moda, Corta.

## Entrada comum

Cada ponto: `{ t, y, n, institute, moe? }`.
`windowDays` = chip da janela (padrão 14).

## off

Pontos + linha do Exp. Sem tracejado de projeção.

## Exp — modelo 1 (padrão)

`peso = √(clamp(n, 100..4000)/2000) × 2^(−dias/janela)`

## Casa — modelo 2

`peso = √(n/2000) × 2^(−dias/meiaVida) × 1/k_instituto`

## Meta — modelo 3

`peso = recência / (σ_i² + τ²) / k_instituto`

## Kalman — modelo 4

θ_t = θ_{t-1} + ruído (~0,16 pp/√day).

## Rápido — modelo 5

Meia-vida curta + impulso nas pesquisas novas.

## Dia — modelo 6

Média √n só do dia de campo. Sem vazar para o dia seguinte.

## Local — modelo 7

LOESS de grau 1 no scatter.

## Centro — escola (janela, uma casa por dia)

- **Média** (8): cada casa vale 1.
- **Peso** (9): média √n.
- **Mediana** (10): valor do meio.
- **Moda** (11): faixa de 0,5 pp mais repetida; empate ou tudo único cai na mediana.
- **Corta** (12): descarta 20% de cada ponta e média o miolo. Poucas casas → mediana.

## Overlays (não são modelo)

SMA 7 / 21, EMA 9 / 21, HMA 16, VWMA 14, KAMA 10, Bollinger 20 ± 2σ.

## Influência do tamanho da amostra

O tamanho da amostra usado nos pesos é limitado a **N=4.000** antes da raiz quadrada. Isso impede que uma pesquisa muito grande domine o agregado apenas pelo tamanho amostral.

## Faixa de incerteza do agregado

Quando exibida, a faixa é uma faixa de incerteza derivada do conjunto e **não é calibrada empiricamente ainda**. Ela não é a margem de erro de nenhuma pesquisa individual e não é probabilidade de vitória. A calibração por backtest/coverage continua em aberto.

## O que isto não é

- Não é MRP estadual.
- Não corrige erro de 2022.
- Não simula 2º turno.
