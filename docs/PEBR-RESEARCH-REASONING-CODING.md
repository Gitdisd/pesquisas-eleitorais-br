# PEBR — Research → Reasoning → Coding brief

**Product:** https://gitdisd.github.io/pesquisas-eleitorais-br/  
**Repo:** Gitdisd/pesquisas-eleitorais-br  
**Written:** 2026-09-15 (America/Sao_Paulo)  
**Purpose:** One file so research, reasoning, and coding do not drift. Next coding session starts here. Do not invent a fifth pipeline.

See the full maintained copy in this path. Companion: [PEBR-ACQUISITION-CONTEXT.md](PEBR-ACQUISITION-CONTEXT.md).

## Boot

Read this file and `docs/PEBR-ACQUISITION-CONTEXT.md` before changing discovery, merge, audit, or UI data loading.

## User thesis (accepted)

Multiple outlets reprint the same poll. That is not noise. That is **witnesses**.

- The written table on outlet A can fill cells that outlet B omitted (branco/nulo, não sabe, n, MOE, TSE code).
- Article `published_at` tells you if coverage is new — not whether the poll is new.
- Same institute + same fieldwork window + same scenario = same poll, even if CNN posts at 20:01 and G1 posts at 21:17.
- Never invent a number to close a hole.

## Identity (freeze)

**Primary:** `tse_protocol + scenario` when protocol exists.  
**Fallback:** `norm(institute) + fieldwork_start + fieldwork_end + scenario`

`published_date` is NOT in the identity.

## Three clocks

| Clock | Field | Meaning |
|---|---|---|
| Fieldwork | fieldwork_start, fieldwork_end | When people were asked. Identity. |
| Registry | tse_protocol | Legal identity. Best key. |
| Coverage | witnesses[].article_published_at | When a site wrote about it. NOT identity. |

## Pipeline shape

SIGNAL → WITNESSES → IDENTITY → CELL RESOLVE → AUDIT → PUBLISH → DISPLAY

## Coding order

Do not add workflows or UI modules first.

1. Docs freeze (CHANGELOG 2026-09-15, SYSTEM.md match code).
2. One identity module used by scripts and front. Remove published_date from keys.
3. witnesses.json append-only per URL; merge cells onto one poll.
4. One runner behind refresh-polls.yml.
5. window.__pebr shared store; ui-refresh must not refetch JSON.

## Definition of done

1. Datafolha 8–10 set residuals appear from Folha/G1 witness without a manual extra row.
2. Reprint on day D+2 does not create a new poll.
3. Overview never says sem data when polls exist.
4. One cron, one identity function, one publish.

## Prompt for next coding pass

```
Read docs/PEBR-ACQUISITION-CONTEXT.md and docs/PEBR-RESEARCH-REASONING-CODING.md in full.
Do not add workflows or UI modules.
Implement identity module first.
Identity key must not include published_date.
Witnesses are sources; polls are identities.
Never invent percentages.
```
