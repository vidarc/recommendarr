# Changelog

## v0.5.0 (2026-04-21)

- fix: use the plex server history API correctly (#58)
- fix: accessibility improvements (#59)
- chore(deps): Bump node in the docker group (#61)
- chore(deps): Bump the production-patch group with 2 updates (#62)
- chore: upgrade yarn and packages
- allow better-sqlite3 to run it's build script
- fix: linting issues and test improvements
- fix: move describe blocks around in unit tests
- chore: formatting
- test: fixing up remaining of tests broken after linting fixes
- docs: spec for redesign B1 (foundations)
- docs: add rem unit convention to B1 spec
- docs: add B1 foundations implementation plan
- refactor(theme): convert spacing/radii tokens to rem, add accentDim + fontSizes
- feat(styles): add global data-tooltip hover rule
- feat(client): add Icon component
- feat(client): add Logo component
- feat(client): add icon-rail Sidebar component
- refactor(client): extract Sidebar from AppLayout
- feat(client): add LoadingBubble with three pulsing dots
- feat(client): rework ChatMessage into two-mode bubble
- feat(client): expose conversationTitle from useChat
- feat(client): conversation-aware header + three-dot loader on Recommendations
- fix(client): gate conversationTitle on urlConversationId to drop stale RTK data
- test(e2e): update selectors for redesigned header and sidebar
- chore(e2e): rebuild compose images on every test run
- chore: update the project status doc

## v0.4.1 (2026-04-15)

- chore(deps): Bump the production-patch group with 2 updates (#46)
- chore(deps): Bump openai in the production-minor group (#47)
- chore(deps-dev): Bump @vitest/coverage-v8 in the dev-patch group (#48)
- docker labels and a MIT license (#52)
- fix: refactor zod usage for consistency and bundle size (#53)
- fix: issue with plex server never getting set for syncing
- fix: better plex popup/oauth flow + auto-close it
- fix: auto update the plex server settings UI after auth
- fix: some review based fixes
- missing msw handler
- fix: upgrade to fastify 5.8.5 (#56)

## v0.4.0 (2026-04-13)

- fix: issue with plex response and zod schema
- feat: adding plenty of debug/info/warn/error server logs
- feat: support some pretty logging with LOGGING_PRETTY (#43)
- docs: add TVDB/TMDB metadata integration design spec
- docs: add TVDB/TMDB metadata implementation plan
- feat: add shared metadata types and Zod schemas
- feat: add metadata_cache table and tvdbId to recommendations
- feat: add TMDB API client with search, details, and credits
- feat: add TVDB v4 API client with search, details, and extended info
- feat: add metadata routes for fetching enriched recommendation data
- feat: add metadata panel to recommendation cards
- test: mock /api/metadata/status in card and recommendations tests
- feat: enrich AI prompts with cast/crew metadata when user asks about actors/directors
- docs: add TVDB/TMDB API keys and metadata routes to documentation
- test(e2e): add metadata enrichment e2e coverage
- fix(metadata): enforce ownership, backfill tmdbId, add panel tests
- test(e2e): fix flaky metadata tests on WebKit
- test(e2e): drop metadata cache e2e test, harden send-message wait
- fix: clearing up some tech debt (#45)

## v0.3.0 (2026-04-11)

- fix: security, accessibility, and reliability improvements across the stack
- claude updates
- clean up changelog, not a release yet
- fix: e2e tests for single-user registration model
- upgrade path-to-regexp (#21)
- fixing the dependabot config + 2d minimum package age (#22)
- ignore nodejs majors for now (#27)
- chore(deps): Bump node in the docker-patch group (#28)
- updating dependabot config (#29)
- chore(deps-dev): Bump drizzle-kit from 1.0.0-beta.19 to 1.0.0-beta.20 (#26)
- chore(deps): Bump drizzle-orm from 1.0.0-beta.19 to 1.0.0-beta.20 (#25)
- feat: add plex library integration for excluding them from recommendations (#31)
- making 5 new agents for work
- docs: add feedback loop design spec
- docs: add feedback loop implementation plan
- feat: add feedback column to recommendations table
- feat: add PATCH /api/recommendations/:id/feedback route
- feat: add feedback context to system prompt builder
- feat: query feedback context and inject into AI system prompt
- feat: add feedback type and RTK Query mutation
- feat: add thumbs up/down feedback buttons to RecommendationCard
- docs: add feedback route to architecture and API docs
- fix: address code review findings for feedback loop
- fix: add CHECK constraint, deduplicate feedback, improve accessibility
- test(e2e): add feedback loop E2E tests with OpenAI-compatible mock
- fix: use JSON code fence format in OpenAI E2E mock response
- e2e testing improvements
- more test fixing
- updating library settings test
- chore(deps-dev): Bump the dev-minor group with 2 updates (#34)
- chore(deps-dev): Bump rolldown from 1.0.0-rc.12 to 1.0.0-rc.13 (#36)
- making better e2e tests (#33)
- package upgrades (#37)
- refactor(library): share types between server and client
- refactor(auth): share auth schemas between server and client
- refactor(ai): share AI schemas between server and client
- refactor(arr): share arr schemas between server and client
- refactor(plex): share plex schemas between server and client
- refactor(chat): share chat schemas between server and client
- fix docker entry
- fix(build): split shared into its own project reference
- fix(build): use tsc -b to follow shared project reference
- fix missing tsconfig
- refactor: address code review followups from shared schemas PR (#39)
- refactor(chat): tighten recommendation feedback type to optional-only (#40)

## v0.2.1 (2026-03-28)

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
