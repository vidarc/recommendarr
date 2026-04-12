import { z } from "zod";

const creditPersonSchema = z.object({
	name: z.string(),
	role: z.string(),
	character: z.string().optional(),
});

const mediaMetadataResponseSchema = z.object({
	available: z.literal(true),
	externalId: z.number(),
	source: z.enum(["tvdb", "tmdb"]),
	title: z.string(),
	overview: z.string().optional(),
	posterUrl: z.string().optional(),
	genres: z.array(z.string()),
	rating: z.number().optional(),
	year: z.number().optional(),
	cast: z.array(creditPersonSchema),
	crew: z.array(creditPersonSchema),
	status: z.string().optional(),
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
