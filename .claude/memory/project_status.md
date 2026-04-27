---
name: project_status
description: Current focus and what's next — not a feature ledger
type: project
---

**Currently shipping:** Redesign B1 (Foundations) merged in PR #69 on 2026-04-21. B2 (Chat input rework) implementation complete on `chat-redesign` branch as of 2026-04-26 — 420 unit + 45 e2e tests green, ready for PR.

**What's next:** Open the B2 PR, then move on to B3–B7 in `docs/superpowers/BACKLOG.md`.

**Where to look for context before suggesting work:**

- `docs/superpowers/HISTORY.md` — one-paragraph summaries of shipped phases with links to design specs
- `docs/superpowers/BACKLOG.md` — upcoming redesign phases (chat input, card, history, token persistence, conversation picker, per-convo filters)
- `docs/superpowers/specs/` — design specs (the _why_ behind decisions)
- `docs/api.md` — authoritative API reference
- `src/server/schema.ts` — authoritative table list

**Why:** A short pointer file decays slower than a long feature list. Keep this file under ~15 lines.
**How to apply:** Read first in any new session. Drill into HISTORY/BACKLOG/specs from here.
