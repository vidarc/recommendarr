---
name: feedback_lint_patterns
description: Oxlint strict rules that frequently trip up code changes — magic numbers, init-declarations, jsx-props-no-spreading, react-perf
type: feedback
---

The project's Oxlint config is very strict. Common lint traps when writing new code:

- **no-magic-numbers**: Every literal number (including 0) must be a named constant. Even `array.length > 0` needs `const EMPTY = 0`.
- **init-declarations**: `let x: Type;` fails — must initialize: `let x: Type | undefined = undefined;`
- **jsx-props-no-spreading**: `{...props}` in JSX is forbidden. Pass each prop explicitly. In tests, use `// eslint-disable-next-line` comment or restructure.
- **react-perf/jsx-no-new-object-as-prop**: Inline `style={{...}}` objects in JSX fail. Extract to a Linaria `css` class instead.
- **exactOptionalPropertyTypes** (tsconfig): Cannot pass `undefined` explicitly to optional props. Must conditionally include the prop or omit it entirely.

**Why:** These cause check failures that block commits (pre-commit hook runs `vp check --fix`).

**How to apply:** When writing or editing code, extract all numbers to named constants, always initialize variables, avoid prop spreading and inline style objects, and handle optional props carefully with exactOptionalPropertyTypes in mind.
