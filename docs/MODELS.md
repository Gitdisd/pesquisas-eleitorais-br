# Modelos da linha (não são prognóstico de urna)

Pontos no gráfico = pesquisas brutas; a data exibida é o **fim de campo**. A linha sólida é a estimativa do modelo ativo. Nenhum modelo publica P(vitória) nem inventa pesquisa.

## Código atual

- `src/aggregate.ts`: despacho e modelos 1–2.
- `src/models/advanced.ts`: modelos 3–7.
- `src/models/school.ts`: centros 8–12.
- `src/stats/contract.js`: contrato canônico de amostra/peso.
- `src/stats/house-effects.js`: efeito de casa compartilhado.
- `src/overlays.js`: indicadores experimentais que não alteram a média principal.

## Entrada comum

Cada ponto de tendência tem `{ t, y, n, institute, moe? }`. A função canônica `sampleSize(n)` limita o tamanho amostral a **100–4.000**, com fallback explícito no contrato.

## Modelo 1 — Exp (padrão)

`weightedTrendV1()` usa o peso canônico:

`peso = sqrt(clamp(N,100..4000)/2000) × 2^(−|dias|/janela)`

A série é calculada diariamente dentro do alcance temporal e só é emitida quando existe observação suficientemente próxima.

## Modelo 2 — Casa

`averageTrend()` aplica primeiro o efeito de casa compartilhado e depois `weightedTrendV2()`.

A agregação usa o mesmo contrato de amostra do modelo 1, recência exponencial e um fator de flooding por instituto/período.

## Modelo 3 — erro de pesquisa

`weightedTrendV3()` combina erro padrão da pesquisa, variância entre pesquisas, recência e flooding. Quando a MOE existe, ela informa o erro padrão; na ausência, o modelo estima o erro a partir de N e da proporção.

## Modelo 4 — estado temporal / Kalman

`weightedTrendV4()` remove efeito de casa e estima uma trajetória temporal com evolução diária, atualização Kalman e suavização retrospectiva.

## Modelo 5 — Rápido

`weightedTrendV5()` reduz a meia-vida efetiva e dá impulso adicional às observações muito recentes.

## Modelo 6 — Dia

`weightedTrendV6()` agrega primeiro por dia e instituto com peso baseado no N normalizado e depois resume os institutos naquele dia.

## Modelo 7 — Local

`weightedTrendV7()` é uma regressão local ponderada no tempo usando kernel tricúbico e peso de tamanho amostral.

## Modelos 8–12 — Centros

`src/models/school.ts` fornece:
- **8 Média:** centros por dia com contribuição igual por instituto.
- **9 Peso:** centros ponderados pelo tamanho amostral.
- **10 Mediana:** mediana das observações.
- **11 Moda:** faixa modal; em empates/baixa repetição usa mediana.
- **12 Corta:** remove 20% das pontas e resume o miolo; com poucos pontos usa mediana.

## Influência do tamanho da amostra

A regra canônica está em `src/stats/contract.js` e aplica **N máximo de 4.000** antes da raiz quadrada. Não devem existir novas constantes de cap em componentes individuais sem uma exceção documentada.

## Incerteza

A faixa do gráfico é uma **faixa de incerteza estimada**, não uma MOE de uma pesquisa individual e não um intervalo de cobertura empiricamente garantido. A calibração temporal existe como pesquisa reproduzível e não foi aplicada silenciosamente à largura pública.

## Projeções

As projeções são visualmente separadas da observação e da média. Os modelos de projeção têm validadores/backtests próprios; as pesquisas de calibração não significam seleção automática de modelo.

## Overlays experimentais

`src/overlays.js` contém SMA, EMA, HMA, VWMA, KAMA e Bollinger. São indicadores analíticos experimentais, não intervalos de confiança, MOE ou probabilidade eleitoral. VWMA usa N como ponderação matemática; isso não deve ser confundido com volume de mercado.

## Composição da primeira rodada

As participações dos candidatos formam uma composição. O sistema atual ainda não impõe uma trajetória conjunta por log-ratio/softmax que some a 100% por construção. Essa é uma questão de pesquisa aberta; simples normalização visual não deve ser apresentada como modelo estatístico.

## Data de referência

O eixo temporal usa `fieldwork_end`. `published_date` é mantida como metadado de disponibilidade/publicação para não misturar “opinião durante o campo” com “informação que já estava pública”.

## Limites de pesquisa ainda abertos

- Tracking-overlap: existe auditoria de sobreposição, mas ainda não um estimador de correlação validado na produção.
- Calibração: cobertura histórica foi estudada em múltiplos folds, mas a largura de produção continua explicitamente não calibrada.
- JavaScript: ainda há código legado fora do núcleo tipado.
- Acessibilidade: a camada ECharts/ARIA e as tabelas foram reforçadas; a associação semântica completa continua como melhoria.
