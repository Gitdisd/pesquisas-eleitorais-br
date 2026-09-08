# Polls data contract (Frontend)

Canonical election-poll records for the static site. **Field names are frozen** — do not rename.
Ping Frontend before any schema changes.

## Live consume URLs

Frontend (Vite) loads polls from:

```js
`${import.meta.env.BASE_URL}data/polls.json`
```

served from Vite `publicDir` → `public/data/polls.json`.

Frontend may also fetch:

```js
`${import.meta.env.BASE_URL}data/meta.json`
```

for the UI stamp **"atualizado em"** (`meta.last_updated`), with fallback to `coverage_summary.as_of` when meta is unavailable.

There is **no envelope** around the polls array (bare `Poll[]`). Frontend also tolerates `{ polls: [...] }` at load time, but the pipeline keeps a bare array.

## Files

| Path | Shape | Purpose |
|------|--------|---------|
| `data/polls.json` | bare `Poll[]` | Source of truth for build / tooling |
| `public/data/polls.json` | same `Poll[]` | Served by Vite (`${BASE_URL}data/polls.json`) |
| `data/meta.json` | `Meta` | Schema version, last update, count, content_hash |
| `public/data/meta.json` | same `Meta` | Served by Vite (`${BASE_URL}data/meta.json`) for UI stamp |
| `data/coverage_summary.json` | free-form object | Coverage notes / institute gaps (optional UI; use `as_of` for UI dates) |
| `public/data/coverage_summary.json` | same | Optional public mirror for Frontend fallback |
| `data/schema/polls.schema.json` | JSON Schema | Formal validation of `Poll[]` |

**Legacy duplicate:** `data/polls_coverage_summary.json` may still exist; the **canonical companion** is `data/coverage_summary.json` (mirrored to `public/data/coverage_summary.json`).

Metadata lives only in `meta.json` (not wrapped into polls JSON).

## `Poll` object

Required unless noted:

| Field | Type | Notes |
|-------|------|--------|
| `institute` | `string` | e.g. Genial/Quaest |
| `fieldwork_start` | `string` | YYYY-MM-DD |
| `fieldwork_end` | `string` | YYYY-MM-DD |
| `published_date` | `string` | YYYY-MM-DD |
| `scenario` | `string` | live examples: `estimulada 1º turno`, `2º turno Lula x Flávio Bolsonaro` |
| `candidates` | `Candidate[]` | at least one |
| `n` | `number` | sample size |
| `margin_of_error` | `string` | e.g. +/-2 pp — keep as string |
| `source_url` | `string` (URL) | must start with `http://` or `https://` |
| `methodology_note` | `string` | free text; **empty string allowed** |
| `verified` | `boolean` | pipeline emits verified===true by default |
| `flag` | `string` | optional; present on ~11/192 live records |

### Not in JSON (Frontend-derived)

Frontend may derive UI-only fields client-side — **do not add these to the JSON schema**:

- `round` — derived from `scenario` text in normalize
- timestamps / ids used only in the chart/table UI

### Candidate

| Field | Type | Notes |
|-------|------|--------|
| name | string | display name or aggregate bucket |
| party_optional | string or null | party acronym or null |
| pct | number | published percent (not re-normalized) |

## Meta (data/meta.json + public/data/meta.json)

Fields:

- `schema_version` (1)
- `last_updated` (ISO-8601 America/Sao_Paulo offset when possible)
- `record_count`
- `source` (`verified published polls`)
- `content_hash` (sha256 hex of the canonical polls JSON string)

- `last_updated` is bumped **only** when polls content hash changes (cron does not empty-commit on timestamp alone).
- If `content_hash` is missing from an older meta file, the pipeline backfills it once without bumping `last_updated`.

## Sort order (stable)

1. fieldwork_end descending
2. published_date descending
3. institute ascending
4. scenario ascending

## Refresh

See `package.json` scripts and `scripts/update-polls.mjs`.

Input priority: CLI path, then `POLL_SOURCE`, then `POLL_SOURCE_URL`, else `data/polls.json`.
Default filter: `verified === true` only (pass `--include-unverified` to keep others).
Daily Action: `.github/workflows/refresh-polls.yml` at `0 9` UTC (~06:00 America/Sao_Paulo).
A successful data push to `main` triggers `deploy-pages.yml` via push-to-main.

## Frontend notes

- **No renames.** `PollsFile = Poll[]` bare array.
- Prefer `${BASE_URL}data/polls.json` from `public/`; `data/polls.json` is source of truth mirrored there.
- Prefer `${BASE_URL}data/meta.json` for "atualizado em"; fallback `coverage_summary.as_of`.
- Filter by scenario / institute; show `flag` when present.
- `margin_of_error` stays a display string.
- Ping Frontend before schema changes.
