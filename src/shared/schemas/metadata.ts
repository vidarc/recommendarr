import * as z from "zod/mini";

const creditPersonSchema = z.object({
	name: z.string(),
	role: z.string(),
	character: z.optional(z.string()),
});

const mediaMetadataResponseSchema = z.object({
	available: z.literal(true),
	externalId: z.number(),
	source: z.enum(["tvdb", "tmdb"]),
	title: z.string(),
	overview: z.optional(z.string()),
	posterUrl: z.optional(z.string()),
	genres: z.array(z.string()),
	rating: z.optional(z.number()),
	year: z.optional(z.number()),
	cast: z.array(creditPersonSchema),
	crew: z.array(creditPersonSchema),
	status: z.optional(z.string()),
});

const metadataUnavailableResponseSchema = z.object({
	available: z.literal(false),
});

const metadataResponseSchema = z.discriminatedUnion("available", [
	mediaMetadataResponseSchema,
	metadataUnavailableResponseSchema,
]);

const metadataStatusResponseSchema = z.object({
	tvdb: z.boolean(),
	tmdb: z.boolean(),
});

type CreditPerson = z.infer<typeof creditPersonSchema>;
type MediaMetadataResponse = z.infer<typeof mediaMetadataResponseSchema>;
type MetadataUnavailableResponse = z.infer<typeof metadataUnavailableResponseSchema>;
type MetadataResponse = z.infer<typeof metadataResponseSchema>;
type MetadataStatusResponse = z.infer<typeof metadataStatusResponseSchema>;

export {
	creditPersonSchema,
	mediaMetadataResponseSchema,
	metadataResponseSchema,
	metadataStatusResponseSchema,
	metadataUnavailableResponseSchema,
};

export type {
	CreditPerson,
	MediaMetadataResponse,
	MetadataResponse,
	MetadataStatusResponse,
	MetadataUnavailableResponse,
};
