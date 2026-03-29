# Changelog

## v0.2.1 (2026-03-28)

- fix: gate registration after first user is created
- fix: mitigate prompt injection in AI title generation
- fix: SSRF validation on Plex server URL selection
- fix: session duration validation for invalid env var values
- fix: cascade delete conversations in a transaction
- fix: N+1 query when loading conversation recommendations
- fix: auth middleware handles URLs with query strings
- fix: modal focus management and ARIA roles for accessibility
- fix: per-service loading state in arr integrations tab
- fix: use wouter Link in auth footer instead of plain anchors
- fix: optimistic chat message reconciliation
- fix: Plex auth polling cancellation on unmount
- fix: granular RTK Query cache tags for conversations
- fix: various test isolation and reliability improvements
- chore: resolve migrations path absolutely for Docker compatibility
- chore: memoize encryption key after first read
- chore(deps): Bump brace-expansion (#18)
- claude memory updates

## v0.2.0 (2026-03-28)

- css fix
- implement helmet headers
- adjust the helmet config
- a better reporter for the pipeline
- set upgradeInsecureRequests to null because webkit
- allow testing the OpenAPI connection before saving it (#11)
- fixing issues to run locally and develop easier
- package upgrades
- always have the test connection button showing
- refactor AI client to use OpenAI SDK and simplify test connection response
- adding \*arr integrations and committing all the docs
- upgrading packages
- feat: add updatedAt column to arrConnections schema
- feat: add arr-client service for Radarr/Sonarr v3 API
- feat: add arr routes for config CRUD, test, lookup, and add
- feat: add RTK Query endpoints for arr operations
- chore(deps): Bump picomatch in the npm_and_yarn group across 1 directory (#13)
- feat: implement working IntegrationsTab with Radarr/Sonarr config
- feat: add AddToArrModal component for media lookup and add
- feat: wire up RecommendationCard with AddToArrModal
- test: add E2E tests for arr integration settings flow
- docs: add arr integration endpoints to API docs and CLAUDE.md
- chore(deps): Bump yaml in the npm_and_yarn group across 1 directory (#14)
- e2e test fix
- yarn up brace-expansion
- docs: add API code-splitting design spec
- docs: add API code-splitting implementation plan
- refactor: add shared types for cross-feature use
- refactor: create auth feature API with injectEndpoints
- refactor: create plex feature API with injectEndpoints
- refactor: create AI feature API with injectEndpoints
- refactor: create chat feature API with injectEndpoints
- refactor: create arr feature API with injectEndpoints
- refactor: split api.ts into feature-scoped API files with injectEndpoints
- feat: add manual Plex token entry for local servers and testing
- feat: add Docker Compose mock services for Plex, Radarr, and Sonarr e2e testing
- test: add e2e tests for Plex connection, AI configuration, and navigation
- test: migrate arr integration e2e tests from browser mocks to server-level mock services

## v0.1.0 (2026-03-23)

- update the readme
- refactor into smaller components and shared hooks
- adding in more unit tests
- implement some code splitting
- better typing and validations

## 2026-03-22

- Initial work mostly done. Still a very large WIP
- Main features added:
  - Plex integration via their login flow
  - Basic LLM integration
  - Chat History with your LLM
