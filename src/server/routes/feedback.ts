import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { feedbackBodySchema, feedbackResponseSchema } from "../../shared/schemas/chat.ts";
import { errorResponseSchema } from "../../shared/schemas/common.ts";
import { conversations, messages, recommendations } from "../schema.ts";

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const feedbackRoutes = (app: FastifyInstance) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	typedApp.patch(
		"/api/recommendations/:id/feedback",
		{
			schema: {
				params: z.object({ id: z.string() }),
				body: feedbackBodySchema,
				response: {
					[StatusCodes.OK]: feedbackResponseSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const { id } = request.params;
			const { feedback } = request.body;

			// Find the recommendation and verify ownership
			const rec = app.db.select().from(recommendations).where(eq(recommendations.id, id)).get();

			if (!rec) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "Recommendation not found" });
			}

			// Verify ownership: recommendation -> message -> conversation -> user
			const msg = app.db.select().from(messages).where(eq(messages.id, rec.messageId)).get();

			if (!msg) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "Recommendation not found" });
			}

			const conversation = app.db
				.select()
				.from(conversations)
				.where(eq(conversations.id, msg.conversationId))
				.get();

			if (!conversation || conversation.userId !== request.user.id) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "Recommendation not found" });
			}

			// Update feedback
			app.db.update(recommendations).set({ feedback }).where(eq(recommendations.id, id)).run();

			request.log.info({ recommendationId: id, feedback }, "recommendation feedback updated");
			return reply.code(StatusCodes.OK).send({ id, feedback });
		},
	);
};

export { feedbackRoutes };
