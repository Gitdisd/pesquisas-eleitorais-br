# Autonomous poll discovery

Headless pipeline for Brazilian national presidential polls. **Primary path = GitHub Actions**; local `npm run discover-polls` is also available for development/debugging.

## Discovery contract

The discovery script is deliberately conservative:

- It reads `data/sources.json` and configured source URLs.
- It uses publication-date watermarking to avoid reprocessing clearly old coverage.
- It extracts only records with enough institute, fieldwork, publication, sample, MOE, scenario and candidate evidence.
- It never writes newly discovered polls directly into `data/polls.json`.
- Verified discoveries are staged in `data/discovery/discovered-polls.json`.
- Incomplete, ambiguous, failed, or PDF-only evidence is placed in discovery inbox state rather than turned into invented percentages.
- The canonical merge later reconciles staged discoveries with existing polls and witness evidence using `src/data/identity.js`.

## Scheduled path

`.github/workflows/refresh-polls.yml` runs hourly at minute 10 and performs:

1. verified corrections / known repairs
2. candidate-registry check
3. broad discovery
4. PDF/text/OCR recovery
5. TSE registry recovery
6. supplement/witness merge
7. deterministic integrity audit
8. quality gate
9. production build
10. commit of changed data and explicit Pages deployment

## Manual / local

```
npm run discover-polls
```

Use this to inspect discovery behavior without treating it as a publication action. For a full production refresh, use the GitHub Actions workflow.

## Safety

- Never invent percentages.
- Never treat article publication time as poll identity.
- Never bypass logins or paywalls.
- Do not turn a state/other-office result into national presidential data.
- Keep TSE pending/conflicting evidence outside the chart until resolved.

## Output state

- `data/discovery/discovered-polls.json` — staged verified discoveries.
- `data/discovery/inbox.json` — incomplete/ambiguous evidence.
- `data/discovery/witnesses.json` — witness URLs and coverage evidence.
- `data/discovery/pending-polls.json` — unresolved TSE registrations.
- `data/discovery/registry-queues.json` — scope classification.
