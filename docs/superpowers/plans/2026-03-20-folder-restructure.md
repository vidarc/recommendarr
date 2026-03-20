# Folder Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `src/client/` and `src/server/` into a scalable folder structure with pages, components, features, routes, and services directories.

**Architecture:** Move files into logical subdirectories while preserving all existing behavior. Update all relative imports to reflect new paths. No code logic changes — purely structural.

**Tech Stack:** TypeScript, git mv, Oxfmt (for import sorting after moves)

---

## File Structure

### Client — Before → After

| File           | Current Path                          | New Path                                    |
| -------------- | ------------------------------------- | ------------------------------------------- |
| App.tsx        | `src/client/App.tsx`                  | stays (but Dashboard extracted)             |
| Dashboard      | inline in App.tsx                     | `src/client/pages/Dashboard.tsx`            |
| Login.tsx      | `src/client/Login.tsx`                | `src/client/pages/Login.tsx`                |
| Register.tsx   | `src/client/Register.tsx`             | `src/client/pages/Register.tsx`             |
| FormField.tsx  | `src/client/FormField.tsx`            | `src/client/components/FormField.tsx`       |
| AuthFooter.tsx | `src/client/AuthFooter.tsx`           | `src/client/components/AuthFooter.tsx`      |
| auth-slice.ts  | `src/client/auth-slice.ts`            | `src/client/features/auth/auth-slice.ts`    |
| Login.test.tsx | `src/client/__tests__/Login.test.tsx` | `src/client/pages/__tests__/Login.test.tsx` |
| App.test.tsx   | `src/client/__tests__/App.test.tsx`   | stays                                       |

Files that **stay at client root**: `entry-client.tsx`, `entry-server.tsx`, `api.ts`, `store.ts`, `theme.ts`, `global-styles.ts`, `css.d.ts`, `index.html`, `App.tsx`

### Server — Before → After

| File          | Current Path               | New Path                            |
| ------------- | -------------------------- | ----------------------------------- |
| api.ts        | `src/server/api.ts`        | `src/server/routes/api.ts`          |
| auth.ts       | `src/server/auth.ts`       | `src/server/routes/auth.ts`         |
| health.ts     | `src/server/health.ts`     | `src/server/routes/health.ts`       |
| auth-utils.ts | `src/server/auth-utils.ts` | `src/server/services/auth-utils.ts` |

Files that **stay at server root**: `server.ts`, `app.ts`, `db.ts`, `ssr.ts`, `schema.ts`, `types.d.ts`

Tests stay at `src/server/__tests__/` — they test via `buildServer()` and don't import route files directly.

---

## Import Updates Required

### Client moves — imports to update:

**Login.tsx → pages/Login.tsx:**

- `./api.ts` → `../api.ts`
- `./auth-slice.ts` → `../features/auth/auth-slice.ts`
- `./AuthFooter.tsx` → `../components/AuthFooter.tsx`
- `./FormField.tsx` → `../components/FormField.tsx`
- `./theme.ts` → `../theme.ts`

**Register.tsx → pages/Register.tsx:**

- Same pattern as Login.tsx

**FormField.tsx → components/FormField.tsx:**

- `./theme.ts` → `../theme.ts`

**AuthFooter.tsx → components/AuthFooter.tsx:**

- `./theme.ts` → `../theme.ts`

**auth-slice.ts → features/auth/auth-slice.ts:**

- No internal imports to update (only imports from `@reduxjs/toolkit`)

**App.tsx (stays, but update imports to moved files):**

- `./Login.tsx` → `./pages/Login.tsx`
- `./Register.tsx` → `./pages/Register.tsx`
- `./store.ts` (type import) → stays

**api.ts (stays, but update imports to moved files):**

- `./auth-slice.ts` → `./features/auth/auth-slice.ts`

**store.ts (stays, but update imports to moved files):**

- `./auth-slice.ts` → `./features/auth/auth-slice.ts`

**Login.test.tsx → pages/**tests**/Login.test.tsx:**

- `../api.ts` → `../../api.ts`
- `../Login.tsx` → `../Login.tsx` (stays same — test moves into pages/**tests**)
- `../store.ts` → `../../store.ts`

**App.test.tsx (stays, but update imports to moved files):**

- `../auth-slice.ts` → `../features/auth/auth-slice.ts`

### Server moves — imports to update:

**app.ts (stays, update imports to moved files):**

- `./api.ts` → `./routes/api.ts`
- `./auth.ts` → `./routes/auth.ts`
- `./health.ts` → `./routes/health.ts`

**api.ts → routes/api.ts:**

- `./schema.ts` → `../schema.ts`
- `fastify` type import → stays
- `fastify-type-provider-zod` type import → stays

**auth.ts → routes/auth.ts:**

- `./auth-utils.ts` → `../services/auth-utils.ts`
- `./schema.ts` → `../schema.ts`

**health.ts → routes/health.ts:**

- No internal imports to update (only `node:process`, `http-status-codes`, `zod`, type imports)

**db.ts (stays, update imports to moved files):**

- `./auth-utils.ts` → `./services/auth-utils.ts`

**auth-utils.ts → services/auth-utils.ts:**

- No internal imports to update (only `node:crypto`, `node:util`)

---

### Task 1: Restructure server files

**Files:**

- Move: `src/server/api.ts` → `src/server/routes/api.ts`
- Move: `src/server/auth.ts` → `src/server/routes/auth.ts`
- Move: `src/server/health.ts` → `src/server/routes/health.ts`
- Move: `src/server/auth-utils.ts` → `src/server/services/auth-utils.ts`
- Modify: `src/server/app.ts` (update imports)
- Modify: `src/server/routes/api.ts` (update imports)
- Modify: `src/server/routes/auth.ts` (update imports)
- Modify: `src/server/db.ts` (update imports)

- [ ] **Step 1: Create directories and move files**

```bash
mkdir -p src/server/routes src/server/services
git mv src/server/api.ts src/server/routes/api.ts
git mv src/server/auth.ts src/server/routes/auth.ts
git mv src/server/health.ts src/server/routes/health.ts
git mv src/server/auth-utils.ts src/server/services/auth-utils.ts
```

- [ ] **Step 2: Update imports in app.ts**

Change in `src/server/app.ts`:

- `./api.ts` → `./routes/api.ts`
- `./auth.ts` → `./routes/auth.ts`
- `./health.ts` → `./routes/health.ts`

- [ ] **Step 3: Update imports in moved route files**

`src/server/routes/api.ts`:

- `./schema.ts` → `../schema.ts`

`src/server/routes/auth.ts`:

- `./auth-utils.ts` → `../services/auth-utils.ts`
- `./schema.ts` → `../schema.ts`

- [ ] **Step 4: Update imports in db.ts**

`src/server/db.ts`:

- `./auth-utils.ts` → `./services/auth-utils.ts`

- [ ] **Step 5: Run checks and tests**

```bash
yarn vp check && yarn vp test
```

Expected: All pass, no import errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move server routes and services into subdirectories"
```

---

### Task 2: Restructure client files

**Files:**

- Move: `src/client/Login.tsx` → `src/client/pages/Login.tsx`
- Move: `src/client/Register.tsx` → `src/client/pages/Register.tsx`
- Move: `src/client/FormField.tsx` → `src/client/components/FormField.tsx`
- Move: `src/client/AuthFooter.tsx` → `src/client/components/AuthFooter.tsx`
- Move: `src/client/auth-slice.ts` → `src/client/features/auth/auth-slice.ts`
- Move: `src/client/__tests__/Login.test.tsx` → `src/client/pages/__tests__/Login.test.tsx`
- Modify: `src/client/App.tsx` (update imports)
- Modify: `src/client/api.ts` (update imports)
- Modify: `src/client/store.ts` (update imports)
- Modify: `src/client/__tests__/App.test.tsx` (update imports)

- [ ] **Step 1: Create directories and move files**

```bash
mkdir -p src/client/pages/__tests__ src/client/components src/client/features/auth
git mv src/client/Login.tsx src/client/pages/Login.tsx
git mv src/client/Register.tsx src/client/pages/Register.tsx
git mv src/client/FormField.tsx src/client/components/FormField.tsx
git mv src/client/AuthFooter.tsx src/client/components/AuthFooter.tsx
git mv src/client/auth-slice.ts src/client/features/auth/auth-slice.ts
git mv src/client/__tests__/Login.test.tsx src/client/pages/__tests__/Login.test.tsx
```

- [ ] **Step 2: Update imports in moved page files**

`src/client/pages/Login.tsx`:

- `./api.ts` → `../api.ts`
- `./auth-slice.ts` → `../features/auth/auth-slice.ts`
- `./AuthFooter.tsx` → `../components/AuthFooter.tsx`
- `./FormField.tsx` → `../components/FormField.tsx`
- `./theme.ts` → `../theme.ts`

`src/client/pages/Register.tsx`:

- `./api.ts` → `../api.ts`
- `./auth-slice.ts` → `../features/auth/auth-slice.ts`
- `./AuthFooter.tsx` → `../components/AuthFooter.tsx`
- `./FormField.tsx` → `../components/FormField.tsx`
- `./theme.ts` → `../theme.ts`

- [ ] **Step 3: Update imports in moved component files**

`src/client/components/FormField.tsx`:

- `./theme.ts` → `../theme.ts`

`src/client/components/AuthFooter.tsx`:

- `./theme.ts` → `../theme.ts`

- [ ] **Step 4: Update imports in root files that referenced moved files**

`src/client/App.tsx`:

- `./Login.tsx` → `./pages/Login.tsx`
- `./Register.tsx` → `./pages/Register.tsx`

`src/client/api.ts`:

- `./auth-slice.ts` → `./features/auth/auth-slice.ts`

`src/client/store.ts`:

- `./auth-slice.ts` → `./features/auth/auth-slice.ts`

- [ ] **Step 5: Update imports in test files**

`src/client/pages/__tests__/Login.test.tsx`:

- `../api.ts` → `../../api.ts`
- `../Login.tsx` → `../Login.tsx` (same relative — test is now in pages/**tests**)
- `../store.ts` → `../../store.ts`

`src/client/__tests__/App.test.tsx`:

- `../auth-slice.ts` → `../features/auth/auth-slice.ts`

- [ ] **Step 6: Run checks and tests**

```bash
yarn vp check && yarn vp test
```

Expected: All pass, no import errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: organize client into pages, components, and features directories"
```

---

### Task 3: Extract Dashboard from App.tsx

**Files:**

- Create: `src/client/pages/Dashboard.tsx`
- Modify: `src/client/App.tsx` (remove Dashboard, SettingItem; add import)

- [ ] **Step 1: Create pages/Dashboard.tsx**

Extract the `SettingItem` component and `Dashboard` component (with all their styles: `dashboardContainer`, `dashboardTitle`, `settingsList`, `settingItem`, `settingKey`, `settingValue`, `emptyState`, `loadingWrapper`) from `App.tsx` into `src/client/pages/Dashboard.tsx`.

The new file should import `css` from `@linaria/atomic`, `useGetSettingsQuery` from `../api.ts`, and theme tokens from `../theme.ts`.

Export `Dashboard` as a named export.

- [ ] **Step 2: Update App.tsx**

Remove the extracted styles and components. Add:

```typescript
import { Dashboard } from "./pages/Dashboard.tsx";
```

Remove the `loadingWrapper` style if it was only used by Dashboard. Keep it if App also uses it (it does — for the top-level loading state). If both use it, keep it in App.tsx and also define it in Dashboard.tsx, or extract to a shared styles file.

- [ ] **Step 3: Run checks and tests**

```bash
yarn vp check && yarn vp test
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: extract Dashboard page from App.tsx"
```

---

### Task 4: Update CLAUDE.md project structure

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Project Structure section**

Replace the current project structure section with:

```markdown
## Project Structure

- `src/server` — Fastify backend
  - `routes/` — Route handlers (api, auth, health)
  - `services/` — Business logic (auth-utils)
  - Root: app factory, entry point, db plugin, SSR plugin, schema
- `src/client` — React frontend
  - `pages/` — Route-level page components (Login, Register, Dashboard)
  - `components/` — Reusable UI primitives (FormField, AuthFooter)
  - `features/` — Feature-scoped state (auth/auth-slice)
  - Root: entry points, store, api, theme, global styles
- `src/shared` — Shared types and utilities (planned, not yet created)
- `docs/` — Architecture decisions, API docs, environment variable reference
- Tests: `__tests__/` folders colocated with source (e.g., `src/client/pages/__tests__/Login.test.tsx`)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update project structure in CLAUDE.md"
```
