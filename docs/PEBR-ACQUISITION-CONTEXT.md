# PEBR — Acquisition & context file

**Load this file at the start of every research / reasoning / coding session.**  
Companion: [PEBR-RESEARCH-REASONING-CODING.md](PEBR-RESEARCH-REASONING-CODING.md).

Updated: 2026-09-15 America/Sao_Paulo.

## A. What an aggregator is

Four jobs: **Detect** (RSS/alerts/TSE) → **Identify** (institute + fieldwork + scenario + TSE protocol) → **Extract** (HTML/PDF cells) → **Compile** (one row, then averages).

CJR Pollfinder: Google Alerts every 30 min → LLM “is this a poll? is it new?” → human confirms.
Poder360 agregador is the BR analog. This repo is a compiler with a weak detector and a confused identifier.

## B. Harvest shape

```
SIGNAL → CLUSTER → WITNESS FETCH → CELL RESOLVE
RSS/News/TSE/X → same or new poll? → 3–8 article URLs → fill empty cells, never invent
```

Article time = coverage. Fieldwork + TSE protocol = identity.
Folha residuals + G1 horse-race + CNN noon read = three witnesses, one poll.

## C. Same vs different

Same poll if after alias-normalize: institute family + fieldwork overlap + same scenario + Brasil/presidente, OR same TSE `BR-#####/2026`.
Different poll if new TSE protocol, new fieldwork wave, or different scenario (1T vs 2T).
Roundups, TV graphics, Wikipedia, other aggregators = signals only.
Conflict: store both; prefer institute PDF / PesqEle; flag Auditoria.

Aliases: Genial/Quaest→quaest; BTG/Nexus→nexus; CNT/MDA→mda; Meio/Ideia→ideia; PoderData/Aya→poderdata; Folha/Datafolha→datafolha.
Residuals: branco/nulo→blank_null; não sabe→dk; glued combo only if institute glued them. Marçal on 1T national after cutoff → out_of_universe.

## D. Publish windows (BRT)

Hottest harvest: **12:00–13:30** and **20:00–21:30**.
Suggested cadence: 07:10, 10:10, 12:10, 15:10, 18:10, 20:10, 21:40 + TSE 08:00 and 20:00.
Embargo pattern: PDF ~11:00 → TV ~12:06 → Folha ~12:40 → G1 ~13:10. First extract incomplete is normal; second witness at +90 min fills residuals.
`Verificar agora` on the site does not run discovery.

## E. Official sources first

1. PesqEle consulta (protocol, n, MOE, fieldwork, cargo). Register ≥5 days before disclosure (Lei 9.504 art. 33; Res. 23.600 / 23.747).
2. TSE Dados Abertos grupo Pesquisas Eleitorais 2026 — https://dadosabertos.tse.jus.br/
3. https://www.tse.jus.br/eleicoes/eleicoes-2026/pesquisas-eleitorais
4. Institute PDFs (Datafolha, Quaest, Atlas, Paraná, Nexus)
5. G1 pesquisas UI as witness, not identity

TSE certifies registration, not that the percentages are true.

## F. Extract layers

0. Catalog in sources.json (kind, trust A/B/C, rss[], notes).
1. Signals: native RSS + Google News RSS + Composio SEARCH_NEWS/WEB.
2. Fetch public HTML only. No login, no paywall bypass, 1 req / 2–4s / host, honor robots. PDF → OCR sidecar. Save url, fetched_at, hash, article_published_at.
3. Cluster by identity; union cells; write one poll + witnesses[].

## G. Minimum harvest set (~90% of national waves)

G1 + Folha + Poder360 + CNN + Estadão + O Globo + Valor + Gazeta do Povo + UOL + institute sites + PesqEle.

### A — source of record
Folha Poder (Datafolha), G1 Eleições (rss2 dynamo pesquisas), Poder360 `/feed/`, CNN `/politica/feed/`, Estadão política Arc feed, O Globo, Valor, Quaest, AtlasIntel, Nexus, Paraná Pesquisas, Ideia.

### B — mirrors
UOL, Metrópoles, Correio Braziliense `/feed`, EM, O Tempo, Gazeta do Povo, GZH, InfoMoney, BBC Brasil, Reuters, Agência Brasil, Jovem Pan `/noticias/politica/feed`, BandNews, SBT News, R7, Terra, iG, Exame, Veja, IstoÉ, CartaCapital `/politica/feed/`, Brazilian Report Beehiiv, Rio Times, Nexo, JOTA, Congresso em Foco, Intercept `/feed/`.

### C — regional reprints
O Povo, Diário do Nordeste, A Tarde, Diário de Pernambuco, Folha PE, O Liberal, Correio do Povo, Zero Hora, O Popular, Campo Grande News, NSC, A Gazeta ES, Tribuna do Norte, Jornal do Commercio PE, Meio Norte, Correio do Estado MS.

### D — detect only
Poder360 Agregador, G1 tracker, PollingData, BBC agregador, ViésLab, Money Times, Wikipedia 2026, this site itself.

### E — signal only
Brasil 247, DCM, Pragmatismo, Oeste, Diário do Poder, Politize `/feed/`, Planalto RSS.

Bias ≠ false table. Folha and Jovem Pan reprinting Datafolha should match; if not, parse error.

## H. RSS

RSS = title + link + pubDate (coverage clock), not the table.
Live-ish: Poder360, CNN política, CartaCapital política, Jovem Pan política, Politize, Intercept, Correio Braziliense, G1 dynamo pesquisas, Google News queries in sources.json, Brazilian Report, Planalto, Estadão Arc (fragile).
HEAD-check feeds; when dead, section HTML + Composio News.

## I. Site vs acquisition

Acquisition writes polls.json + witnesses.json + completeness/integrity.
Display reads one store (`window.__pebr`). Label two clocks. Auditoria chip for missing cells + TSE-not-in-file. Do not add chart overlays until Datafolha 8–10 set residuals fill from Folha automatically.

## J. Legal (BR 2026)

Public pages only. No barrier bypass. Cite URL. Quote numbers, not full articles. PesqEle/Dados Abertos are for machines.

## K. Session boot

1. Read this file and the research-reasoning brief.
2. No new workflow until this harvest exists.
3. Article datetime ≠ poll identity.
4. Fill a cell from a second witness rather than create a row.
5. Append learning under L. Log.

## L. Log

- 2026-09-15 — File created and committed. Aggregators, TSE, BR windows, 50+ outlets, RSS, polite scrape, same-vs-different rules.
