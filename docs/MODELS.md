# Modelos da linha (não são prognóstico de urna)

Pontos no gráfico = pesquisas brutas, data = **fim de campo**.
Linha sólida = média do chip ativo. Cartões usam a mesma função.
Nenhum modelo publica P(vitória) nem inventa pesquisa.

Código: `src/aggregate.js` (1 e 2), `src/models-advanced.js` (3 e 4).
Dispatch: `averageTrend(points, windowDays, model)`.

## Entrada comum

Cada ponto: `{ t, y, n, institute, moe? }`.
`windowDays` = chip da janela (padrão 14). Meia-vida / alcance usam isso.

## off

Pontos + linha do Modelo 1. Sem tracejado de projeção.

## Modelo 1 — média antiga

`peso = √(n/2000) × exp(−dias/janela)`

- n ausente → 800; n limitado a 100–8000.
- Só desenha o dia se existir pesquisa a ≤ janela dias.
- Projeção tracejada (opcional): régua linear amortecida em `src/projection.js`. Não é urna.

## Modelo 2 — meia-vida + house

`peso = √(n/2000) × 2^(−dias/meiaVida) × 1/k_instituto`

- Meia-vida = janela.
- k = quantas pesquisas da mesma casa caem na janela (≤14d) — evita inundar.
- House: desvio vs outras casas em ±14d, encolhido `n/(n+4)`.
- Linha sólida = média já debiasada.
- Tracejado Modelo 2 só se o holdout de 7 dias ganhar de “ficar parado”.

## Modelo 3 — meta-análise de efeitos aleatórios

Erro amostral σ_i:
- se há margem → margem/1,96
- senão → 1,3 × √[y(100−y)/n]  (deff 1,3 para amostra conglomerada)

τ² = DerSimonian–Laird no conjunto da janela (desacordo **além** do erro amostral: modo, geografia, casa).

`peso = recência / (σ_i² + τ²) / k_instituto`

Atlas n=5000 não come o gráfico sozinho. Não usa fundamentos nem 2022.

## Modelo 4 — intenção latente (Kalman + RTS)

Estado: θ_t = θ_{t−1} + ruído de processo (~0,16 pp/√day).
Observação: y_i = θ_{t_i} + house_i + ε_i, Var(ε_i)=σ_i².
Ida = filtro; volta = smoother de Rauch–Tung–Striebel.
A linha é o estado da disputa até o último campo, não uma projeção até 4/out.

## O que isto não é

- Não é MRP estadual (só há nacionais no JSON).
- Não corrige pelo erro de 2022 de cada instituto.
- Não simula 2º turno.
- Traço Chart.js (`tension: 0.25`) é cosmético; a conta é diária.
