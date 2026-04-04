---
name: DB operations should be transactional
description: Multi-step DB mutations (delete+insert, related table updates) must be wrapped in transactions
type: feedback
---

Wrap multi-step database mutations in `app.sqlite.transaction(() => { ... })()` to prevent partial state on failure.

**Why:** The library sync had a delete-then-insert that could lose all data if the insert failed mid-way. User wants atomicity for all related DB writes.

**How to apply:** Any time you write code that does delete+insert, or updates multiple related tables, wrap it in a transaction. Use `app.sqlite.transaction()` (better-sqlite3 pattern used in this project).
