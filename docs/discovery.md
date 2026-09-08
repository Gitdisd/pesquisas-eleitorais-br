# Autonomous poll discovery

Headless pipeline for Brazilian national presidential polls. **Primary path = GitHub Actions only** — no human and no Grok / Chief-of-Staff / Poll-Research bot required for the happy path.

Actions-first / bots-offline owns **discover → update → commit**. The scheduled workflow discovers new polls, validates/mirrors them, then commits `data/` + `public/data/` when porcelain shows changes.

## Happy path (Actions-only)

testline
## Autonomy
Never invent numbers; inbox for hard pages; soft fetch failures OK; bump last_check_at.
