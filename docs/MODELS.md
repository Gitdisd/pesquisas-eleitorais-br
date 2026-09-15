# Modelos da linha (não são prognóstico de urna)

Pontos no gráfico = pesquisas brutas, data = **fim de campo**.
Linha sólida = média do chip ativo. Cartões usam a mesma função.
**Padrão do site = Exp (modelo 1).**
Nenhum modelo publica P(vitória) nem inventa pesquisa.

Código: `src/aggregate.ts` (1 e 2), `src/models/advanced.ts` (3–7).
Overlays visuais: `src/overlays.js` — não alteram a média.
Dispatch: `averageTrend(points, windowDays, model)`.

Chips: off, Exp, Casa, Meta, Kalman, Rápido, Dia, Local.

## Entrada comum

Cada ponto: `{ t, y, n, institute, moe? }`.
`windowDays` = chip da janela (padrão 14).

## off

Pontos + linha do Exp. Sem tracejado de projeção.

## Exp — modelo 1 (padrão)

`peso = √(n/2000) × exp(−dias/janela)`

- n ausente → 800; n limitado a 100–8000.
- Só desenha o dia se existir pesquisa a ≤ janela dias.

## Casa — modelo 2

`peso = √(n/2000) × 2^(−dias/meiaVida) × 1/k_instituto`

## Meta — modelo 3

`peso = recência / (σ_i² + τ²) / k_instituto`
σ via margem/1,96 ou deff 1,3 × √[p(1-p)/n]. τ² = DerSimonian–Laird.

## Kalman — modelo 4

θ_t = θ_{t-1} + ruído (~0,16 pp/√day). Casa + erro amostral na observação.

## Rápido — modelo 5

Meia-vida = max(2, janela/5).
`peso = √(n/2000) × 2^(-d/half) × (1 + 2 e^(-d/1,8))`
Sem house. Reage rápido a pesquisa nova.

## Dia — modelo 6

Agrupa por fim de campo. Primeiro colapsa a mesma casa no mesmo dia (média √n). Depois média √n entre casas. Sem janela: o ponto é só aquele dia. Linha liga os dias que têm pesquisa.

## Local — modelo 7

LOESS de grau 1. Em cada dia t, tricube na janela H, peso √n, reta local y = a + b(t_i-t). Plota a. Se <3 pontos, cai para média ponderada (grau 0).

## Overlays (não são modelo)

Cada chip liga/desliga sozinho. Calculados em cima da linha do modelo ativo:
SMA 7 / 21, EMA 9 / 21, HMA 16, VWMA 14 (peso = n da pesquisa), KAMA 10, Bollinger 20 ± 2σ.

## O que isto não é

- Não é MRP estadual.
- Não corrige erro de 2022.
- Não simula 2º turno.
- Overlay de pregão não é estatística eleitoral; é régua visual.
