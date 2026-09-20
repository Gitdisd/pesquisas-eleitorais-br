# PEBR — Acquisition & context file

**Load this file at the start of every research / reasoning / coding session.**  
Companion: [PEBR-RESEARCH-REASONING-CODING.md](PEBR-RESEARCH-REASONING-CODING.md).

Updated: 2026-09-20 America/Sao_Paulo.

## A. What an aggregator is

Four jobs: **Detect** (RSS/alerts/TSE) → **Identify** (institute + fieldwork + scenario + TSE protocol) → **Extract** (HTML/PDF cells) → **Compile** (one row, then averages).

This repository is a compiler with automated discovery, staged evidence, TSE registry recovery, deterministic audits, and a conservative publish gate.

## B. Harvest shape

```
SIGNAL → CLUSTER → WITNESS FETCH → CELL RESOLVE
RSS/News/TSE/X → same or new poll? → article/PDF URLs → fill empty cells, never invent
```

Article time = coverage. Fieldwork + TSE protocol = identity.

## C. Same vs different

Same poll when the shared identity contract matches: TSE `BR-#####/2026` + scenario + geography when available, otherwise normalized institute family + fieldwork start/end + scenario + geography.

Different poll if new TSE protocol, new fieldwork wave, or different scenario (1T vs 2T).

Roundups, TV graphics, Wikipedia, other aggregators = signals only.
Conflict: preserve evidence, prefer institute/PesqEle where the evidence is stronger, and flag the audit state.

Aliases: Genial/Quaest→quaest; BTG/Nexus→nexus; CNT/MDA→mda; Meio/Ideia→ideia; PoderData/Aya→poderdata; Folha/Datafolha→datafolha.
Residuals: branco/nulo→blank_null; não sabe→dk; glued combo only if institute glued them.

## D. Publish / refresh cadence

The production refresh workflow runs **hourly at minute 10** (`10 * * * *`) plus manual dispatch. This is intentionally offset from the top of the hour.

A refresh can perform discovery, PDF/OCR recovery, TSE registry recovery, merge, audits, quality validation and production build. If canonical/public data changes, it commits the data and explicitly dispatches the Pages deployment.

`Verificar agora` on the site does not run discovery or GitHub Actions.

## E. Official sources first

1. PesqEle consulta (protocol, n, MOE, fieldwork, cargo).
2. TSE Dados Abertos — https://dadosabertos.tse.jus.br/
3. TSE pesquisas eleitorais — https://www.tse.jus.br/eleicoes/eleicoes-2026/pesquisas-eleitorais
4. Institute PDFs.
5. Major outlets as witnesses, not identity authorities when a stronger registration/source exists.

TSE certifies registration, not that the percentages are true.

## F. Extract layers

0. Catalog sources in `data/sources.json`.
1. Signals: configured RSS/HTML discovery.
2. Fetch public HTML only; no login or paywall bypass. PDFs can go through text extraction/OCR, but uncertain extraction remains evidence/inbox rather than invented data.
3. Stage complete verified discoveries in `data/discovery/discovered-polls.json`.
4. Cluster by identity; union witness evidence and resolve cells.
5. Publish only after deterministic integrity + quality gates.

## G. Site vs acquisition

Acquisition writes canonical data plus discovery/audit state.
Display reads one store (`window.__pebr`). Label fieldwork and publication clocks. Never create a second poll row just because another outlet publishes the same fieldwork wave later.

## H. Operational safety

- Sample dataset shrinkage is guarded in `update-polls.mjs`; large unexpected reductions fail unless explicitly overridden.
- Pending/conflicting TSE registrations remain outside chart-visible national data.
- National-president, state-president and other-office registry queues are separated.
- Deep repair is manual-only, read-only, and cannot push or open pull requests.

## I. Session boot

1. Read this file and the research-reasoning brief.
2. Reuse the shared identity module; do not create another poll-key implementation.
3. Article datetime ≠ poll identity.
4. Fill a cell from a second witness rather than create a duplicate row.
5. Run audits/quality gate before considering a change publishable.

## J. Log

- 2026-09-15 — File created and committed. Aggregators, TSE, BR windows, 50+ outlets, RSS, polite scrape, same-vs-different rules.
- 2026-09-20 — Updated for staged discovery, TSE recovery queues, hourly refresh, explicit refresh→Pages dispatch, conservative PDF/OCR handling, and read-only manual deep repair.
