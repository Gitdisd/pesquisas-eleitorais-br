# PEBR — Research → Reasoning → Coding brief

**Product:** https://gitdisd.github.io/pesquisas-eleitorais-br/  
**Repo:** gitdisd/pesquisas-eleitorais-br  
**Updated:** 2026-09-20 (America/Sao_Paulo)  
**Purpose:** One file so research, reasoning, and coding do not drift.

See the maintained acquisition context in [PEBR-ACQUISITION-CONTEXT.md](PEBR-ACQUISITION-CONTEXT.md).

## Boot

Read this file and `docs/PEBR-ACQUISITION-CONTEXT.md` before changing discovery, merge, audit, or UI data loading.

## User thesis (accepted)

Multiple outlets reprint the same poll. That is not noise. They are **witnesses**.

- A witness can fill cells that another source omitted.
- Article `published_at` tells you when coverage appeared — not whether the poll is new.
- Same institute + same fieldwork window + same scenario normally describes the same poll.
- Never invent a number to close a hole.

## Identity contract

**Primary:** `tse_protocol + scenario + geography` when protocol exists.  
**Fallback:** normalized `institute + fieldwork_start + fieldwork_end + scenario + geography`.

`published_date` is NOT in identity.

TSE enrichment can re-key a fallback record to its registered protocol instead of creating a duplicate.

## Three clocks

| Clock | Field | Meaning |
|---|---|---|
| Fieldwork | fieldwork_start, fieldwork_end | When people were asked. Identity |
| Registry | tse_protocol | Legal/registration identity |
| Coverage | published_date / witness coverage dates | When coverage appeared; not identity |

## Pipeline shape

SIGNAL → WITNESSES → IDENTITY → CELL RESOLVE → AUDIT → PUBLISH → DISPLAY

## Current pipeline

1. **Discover:** configured source pages/RSS/signals are fetched; complete evidence is staged, not written directly into the canonical national dataset.
2. **Recover:** PDF/text/OCR evidence is placed into the discovery state for later reconciliation.
3. **Registry:** TSE evidence is recovered and classified into national-president, state-president, or other-office queues.
4. **Merge:** canonical polls, supplements and witnesses are reconciled using the shared identity module.
5. **Audit:** deterministic integrity and completeness checks run before publication.
6. **Publish:** canonical and public mirrors plus metadata are updated.
7. **Display:** the browser consumes one shared `window.__pebr` national snapshot.

## Coding order

1. Read acquisition + reasoning docs.
2. Reuse `src/data/identity.js` for every poll identity operation.
3. Preserve publication dates as coverage metadata.
4. Treat witnesses as evidence, not new polls.
5. Keep national and regional/state-president data separated.
6. Keep the chart refresh in-place so pan/zoom/pinch state survives.
7. Run typecheck, build, tests and quality/integrity audits before merging.

## Definition of done

1. Same-poll reprints do not create duplicate identities.
2. TSE-enriched fallback records can be reconciled without duplicate rows.
3. Publication dates remain visible.
4. National chart reads only national presidential data.
5. Regional multi-geo views never display a blended mean.
6. Uncertainty ribbon is clearly distinguished from individual survey MOE.
7. Refresh, CI and Pages deployment all complete successfully.

## Current operational notes

- Scheduled refresh: hourly at minute 10.
- If refresh changes data, it explicitly dispatches the Pages deployment after the `GITHUB_TOKEN` push.
- Deep repair is manual-only and read-only.
- `Verificar agora` reloads published JSON; it does not trigger Actions.

## Prompt for next coding pass

```
Read docs/PEBR-ACQUISITION-CONTEXT.md and docs/PEBR-RESEARCH-REASONING-CODING.md in full.
Reuse src/data/identity.js for poll identity.
Do not include published_date in identity.
Treat witnesses as evidence, not separate polls.
Do not invent percentages.
Preserve national/state-president separation.
Run tests, quality gates, and the production build before merging.
```
