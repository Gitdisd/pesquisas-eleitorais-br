# Repository cleanup certification — 2026-09-22

## Scope

This cleanup is intentionally conservative. A file is removed only when the current repository evidence shows that it is outside all current runtime/build/test/workflow dependency paths.

Reference production head before cleanup: `2bca80edc941e6bfc770bc63d6eba378e5b98e41`.

The public application is a Vite static site. Its browser entry surface is `index.html`; its runtime dependencies are the modules reachable from those entries plus published `public/**` assets. CI/workflows form the repository-side execution surface.

## Certification test

For a candidate file, the audit checked:

1. Browser entry/reference: no `index.html` entry or source-module import/dynamic reference.
2. Build/package reference: no `package.json` script or build configuration dependency.
3. Workflow reference: no workflow step executes the file. Stale path-filter mentions are treated separately because they do not execute a file.
4. Repository code reference: no current source/test/pipeline module depends on it.
5. Documentation/runtime architecture: no current system documentation identifies it as a live component.
6. Public asset surface: it is not required under `public/**` for Pages delivery.
7. Replacement proof: where applicable, the current implementation already contains the behavior the candidate once provided.

This certifies absence from the repository's current execution graph. It does not certify absence of hypothetical third-party scripts that a person could have copied from the repository.

## Removed in this pass

| File | Evidence | Disposition |
|---|---|---|
| `src/fetch-bust.js` | No `index.html` entry and no current source import. Cache-busting is implemented directly by `main.js` for background refreshes. | **Removed** |
| `src/models-advanced.js` | 37-byte re-export shim; no current source/test/workflow import. The live TypeScript module is imported directly as `src/models/advanced.ts`. | **Removed** |
| `scripts/repair-source.mjs` | One-time self-modifying repair helper; no current package/workflow execution path. Current system documentation states the self-modifying parser behavior was removed. | **Removed** |
| `scripts/run-poll-pipeline.mjs` | Older registry resolver; `npm run poll-pipeline` executes `run-poll-pipeline-v4.mjs`, which invokes the canonical `poll-pipeline.mjs` parser. No current execution path invokes the older resolver. | **Removed** |

The registry-proof workflow also contained stale path filters for the removed resolver and a nonexistent v3 resolver. Those path filters were removed; the workflow still watches the active `poll-pipeline.mjs` and `run-poll-pipeline-v4.mjs` paths.

## Explicitly retained after audit

The following were inspected but are **not** dead under the repository's current execution graph:

- `scripts/discover-policy.mjs`: imported by `scripts/discover-polls.mjs`.
- `scripts/poll-pipeline.mjs`: active canonical TSE registry parser, called by v4.
- `scripts/run-poll-pipeline-v4.mjs`: active `npm run poll-pipeline` implementation.
- `scripts/check-estimator-equivalence.mjs`, `scripts/check-wasm-parity.mjs`: active CI/Pages validation.
- `scripts/repair-now.yml`, `deep-repair.yml`, `pipeline-smoke.yml`, `registry-proof.yml`: manual/triggered maintenance and proof workflows; absence from the browser bundle does not make them dead.
- `src/aggregate.js`: compatibility re-export actively imported by the browser.
- `src/models/school.ts`: actively imported by the advanced model dispatcher.
- `src/ui-upgrades.js`: actively imported by `ui-refresh.js`.
- All current `public/data/**` audit/status mirrors: these are part of the published Pages asset surface even when not loaded by the primary chart.

## Duplicate-data note

`data/coverage_summary.json` and `data/polls_coverage_summary.json` are byte-identical, and the updater still explicitly checks the legacy filename first. That makes it a **refactor candidate**, not a dead-file deletion in this pass. It should only be removed together with the fallback code and a validation run proving the updater produces the same published result.

The other exact duplicate `data/**` ↔ `public/data/**` pairs are intentional source/public mirrors and are retained.

## Validation

The cleanup branch is based on the fully validated application revision `d78b326fb83c1a6276c6f7e009f2d7ed9899e979` plus the documentation-only main commit `2bca80edc941e6bfc770bc63d6eba378e5b98e41`.

Application evidence already completed before cleanup:
- CI #291 passed.
- Browser Smoke #19 passed 10/10 across desktop and Pixel-5-sized mobile Chromium.
- Pages deployment #390 succeeded for the validated application revision.
- Pages deployment #391 subsequently succeeded for the documentation-only main revision.

A direct HTTP/DOM fetch of the public Pages URL remains unavailable from the current browsing environment, so this audit does not claim an independently fetched live DOM. The Pages workflow and hosted-browser smoke path remain the reproducible deployment/runtime evidence.

## Future cleanup rule

Do not delete a file solely because it has no browser import. Pipeline scripts, CI-only validators, public data mirrors, manual repair workflows and research modules can be intentionally active outside the browser bundle. Future deletion candidates should receive the same execution-graph and replacement-proof check before removal.
