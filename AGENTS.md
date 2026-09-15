# Agent instructions (Grok / ChatGPT / Copilot)

Before changing discovery, merge, audit, or UI data loading, read these two files in full:

1. [docs/PEBR-ACQUISITION-CONTEXT.md](docs/PEBR-ACQUISITION-CONTEXT.md) — how polls are published, harvested, and recognized as same vs new
2. [docs/PEBR-RESEARCH-REASONING-CODING.md](docs/PEBR-RESEARCH-REASONING-CODING.md) — identity contract, display interworking, coding order

Rules:
- Do not add a new GitHub workflow until the harvest pipeline in the acquisition file exists.
- Poll identity is `tse_protocol + scenario`, else `institute + fieldwork_start + fieldwork_end + scenario`.
- `published_date` / article time is coverage, not identity.
- Witnesses fill missing cells. Reprints are not new polls.
- Never invent percentages.
- Append learning to section L of the acquisition file instead of rewriting history.
