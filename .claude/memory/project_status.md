---
name: project_status
description: Current focus and what's next — not a feature ledger
type: project
---

**Currently shipping:** Redesign B1 (Foundations) merged in PR #69 on 2026-04-21. The branch history through `main` is the authoritative record of past work.

**What's next:** Redesign phases B2–B7 in `docs/superpowers/BACKLOG.md`. Nothing in flight on a branch at the moment.

**Where to look for context before suggesting work:**

- `docs/superpowers/HISTORY.md` — one-paragraph summaries of shipped phases with links to design specs
- `docs/superpowers/BACKLOG.md` — upcoming redesign phases (chat input, card, history, token persistence, conversation picker, per-convo filters)
- `docs/superpowers/specs/` — design specs (the _why_ behind decisions)
- `docs/api.md` — authoritative API reference
- `src/server/schema.ts` — authoritative table list

**Why:** A short pointer file decays slower than a long feature list. Keep this file under ~15 lines.
**How to apply:** Read first in any new session. Drill into HISTORY/BACKLOG/specs from here.
