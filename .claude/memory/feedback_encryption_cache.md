---
name: feedback_encryption_cache
description: Encryption key is cached at module level — tests must call resetKeyCache() after stubbing env vars
type: feedback
---

The encryption service (`src/server/services/encryption.ts`) caches the validated ENCRYPTION_KEY in a module-level variable after first read. This means `vi.stubEnv("ENCRYPTION_KEY", ...)` in tests has no effect after the key has been cached by a prior test.

**Why:** Added caching for performance (avoids re-reading env var on every encrypt/decrypt call). Tests that ran fine before caching broke because `vi.stubEnv` no longer took effect.

**How to apply:** Always call `resetKeyCache()` (exported from encryption.ts) in test cleanup when testing encryption with different keys. The encryption.test.ts file does this in `afterEach`.
