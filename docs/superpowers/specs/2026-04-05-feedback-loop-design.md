# Feedback Loop Design

## Overview

Add thumbs-up/thumbs-down feedback on recommendations so the AI learns user preferences over time. Feedback persists across conversations and is injected into the system prompt to influence future recommendations.

## Decisions

- **Storage:** nullable `feedback` column on existing `recommendations` table (not a separate table)
- **Feedback type:** binary — `"liked"` | `"disliked"` | `null` (no text reasons, no ternary "not interested")
- **Prompt injection:** most recent 50 feedback items injected into system prompt, capped (no summarization)
- **Toggle:** users can change or remove feedback at any time (click same button to clear, opposite to switch)
- **Cross-conversation:** feedback from all conversations is included in new conversation prompts
- **Current conversation:** feedback given mid-conversation is picked up on the next message naturally (via system prompt rebuild)

## Schema

Add one column to the `recommendations` table in `src/server/schema.ts`:

```ts
feedback: text("feedback"),  // "liked" | "disliked" | null
```

Migration adds the column with a `null` default to existing rows. The auto-generated Zod schemas (`createSelectSchema`/`createInsertSchema`) pick up the new column automatically.

## API

### `PATCH /api/recommendations/:id/feedback`

Sets, changes, or clears feedback on a recommendation.

**Request:**

```json
{ "feedback": "liked" | "disliked" | null }
```

**Response (200):**

```json
{ "id": "rec-uuid", "feedback": "liked" }
```

**Validation:**

- Auth required (session cookie via existing auth middleware)
- Recommendation must exist and belong to the authenticated user
- Ownership check: `recommendations` → `messages.conversationId` → `conversations.userId`

**Error responses:**

- 401 Unauthorized — no valid session
- 404 Not Found — recommendation doesn't exist or doesn't belong to user

## Prompt Builder

### New option: `feedbackContext`

Add to `BuildSystemPromptOptions`:

```ts
interface FeedbackItem {
	title: string;
	year: number | undefined;
	mediaType: string;
	feedback: "liked" | "disliked";
}

interface BuildSystemPromptOptions {
	// ...existing fields...
	feedbackContext?: FeedbackItem[];
}
```

### Prompt section format

Injected after the exclusion section, before the result count instruction:

```
The user has provided feedback on past recommendations:
Liked: Movie A (2023), Show B (2021), Movie C (2024)
Disliked: Movie D (2022), Show E (2020)

Use this feedback to inform your recommendations. Suggest more content similar to liked items and avoid content similar to disliked items.
```

If no feedback exists, the section is omitted entirely.

## Chat Route Changes

In `POST /api/chat`, alongside the existing exclusion context query:

1. Query recent feedback: join `recommendations` → `messages` → `conversations` where `conversations.userId` matches and `recommendations.feedback` is not null
2. Order by `messages.createdAt` desc, limit 50
3. Map to `FeedbackItem[]` and pass as `feedbackContext` to `buildSystemPrompt`

## Frontend

### Shared Types

Update `src/client/shared/types.ts`:

```ts
interface Recommendation {
	// ...existing fields...
	feedback?: "liked" | "disliked" | null;
}
```

### RecommendationCard

Add thumbs-up and thumbs-down buttons to the existing `actionRow` in `src/client/components/RecommendationCard.tsx`:

- Buttons appear next to the "Add to Arr" button, always visible (no connection requirement)
- **Thumbs up:** default muted color, highlighted green when `feedback === "liked"`
- **Thumbs down:** default muted color, highlighted red when `feedback === "disliked"`
- Click active button → sends `null` (clears feedback)
- Click inactive button → sends `"liked"` or `"disliked"`
- Unicode thumbs characters for icons (no icon library dependency): 👍 / 👎

### RTK Query

New mutation endpoint in `src/client/features/chat/api.ts`:

```ts
updateFeedback: build.mutation<
	{ id: string; feedback: "liked" | "disliked" | null },
	{ id: string; feedback: "liked" | "disliked" | null }
>;
```

- Optimistic cache update: patch the recommendation's `feedback` in the conversation detail cache immediately
- Rollback on error
- No tag invalidation needed if using optimistic updates

### Response Schema Updates

The existing `recommendationSchema` in `src/server/routes/chat.ts` needs a `feedback` field:

```ts
feedback: z.enum(["liked", "disliked"]).nullable().optional(),
```

All routes that return recommendations (chat response, conversation detail) will include the feedback value.

## Files to Create or Modify

| File                                           | Change                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `src/server/schema.ts`                         | Add `feedback` column to `recommendations`                             |
| `src/server/routes/chat.ts`                    | Add feedback query in POST /api/chat, add feedback to response schemas |
| `src/server/routes/feedback.ts`                | New file: PATCH route for setting feedback                             |
| `src/server/app.ts`                            | Register feedback routes                                               |
| `src/server/services/prompt-builder.ts`        | Add `feedbackContext` option and prompt section                        |
| `src/client/shared/types.ts`                   | Add `feedback` to `Recommendation` interface                           |
| `src/client/components/RecommendationCard.tsx` | Add thumbs up/down buttons                                             |
| `src/client/features/chat/api.ts` (or similar) | Add `updateFeedback` mutation                                          |
| `drizzle/migrations/`                          | Auto-generated migration for new column                                |
| `docs/`                                        | Update route documentation                                             |
| `CLAUDE.md`                                    | Add PATCH route to architecture overview                               |

## Out of Scope

- Text reasons for feedback (future enhancement)
- Feedback summarization / pattern detection (future, see token management backlog item)
- Feedback analytics or stats page
- Bulk feedback operations
