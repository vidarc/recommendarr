import { z } from "zod";

const MIN_STRING_LENGTH = 1;

const arrServiceTypeSchema = z.enum(["radarr", "sonarr"]);

const arrConnectionResponseSchema = z.object({
	id: z.string(),
	serviceType: arrServiceTypeSchema,
	url: z.string(),
	apiKey: z.string(),
});

const arrConfigBodySchema = z.object({
	url: z.string().url(),
	apiKey: z.string().min(MIN_STRING_LENGTH),
});

const arrTestConnectionBodySchema = z.object({
	serviceType: arrServiceTypeSchema,
});

const arrTestConnectionResponseSchema = z.object({
	success: z.boolean(),
	version: z.string().optional(),
	error: z.string().optional(),
});

const arrRootFolderSchema = z.object({
	id: z.number(),
	path: z.string(),
	freeSpace: z.number(),
});

const arrQualityProfileSchema = z.object({
	id: z.number(),
	name: z.string(),
});

const arrOptionsResponseSchema = z.object({
	rootFolders: z.array(arrRootFolderSchema),
	qualityProfiles: z.array(arrQualityProfileSchema),
});

const arrLookupBodySchema = z.object({
	serviceType: arrServiceTypeSchema,
	title: z.string().min(MIN_STRING_LENGTH),
	year: z.number().optional(),
});

const arrLookupResultSchema = z.object({
	title: z.string(),
	year: z.number(),
	tmdbId: z.number().optional(),
	tvdbId: z.number().optional(),
	overview: z.string(),
	existsInLibrary: z.boolean(),
	arrId: z.number(),
});

const arrAddBodySchema = z.object({
	serviceType: arrServiceTypeSchema,
	recommendationId: z.string(),
	tmdbId: z.number().optional(),
	tvdbId: z.number().optional(),
	title: z.string().min(MIN_STRING_LENGTH),
	year: z.number(),
	qualityProfileId: z.number(),
	rootFolderPath: z.string().min(MIN_STRING_LENGTH),
});

const arrAddResponseSchema = z.object({
	success: z.boolean(),
	error: z.string().optional(),
});

const arrServiceTypeParamsSchema = z.object({
	serviceType: arrServiceTypeSchema,
});

type ArrServiceType = z.infer<typeof arrServiceTypeSchema>;
type ArrConnectionResponse = z.infer<typeof arrConnectionResponseSchema>;
type ArrConfigBody = z.infer<typeof arrConfigBodySchema>;
type ArrTestConnectionBody = z.infer<typeof arrTestConnectionBodySchema>;
type ArrTestConnectionResponse = z.infer<typeof arrTestConnectionResponseSchema>;
type ArrOptionsResponse = z.infer<typeof arrOptionsResponseSchema>;
type ArrLookupBody = z.infer<typeof arrLookupBodySchema>;
type ArrLookupResult = z.infer<typeof arrLookupResultSchema>;
type ArrAddBody = z.infer<typeof arrAddBodySchema>;
type ArrAddResponse = z.infer<typeof arrAddResponseSchema>;

export {
	arrAddBodySchema,
	arrAddResponseSchema,
	arrConfigBodySchema,
	arrConnectionResponseSchema,
	arrLookupBodySchema,
	arrLookupResultSchema,
	arrOptionsResponseSchema,
	arrQualityProfileSchema,
	arrRootFolderSchema,
	arrServiceTypeParamsSchema,
	arrServiceTypeSchema,
	arrTestConnectionBodySchema,
	arrTestConnectionResponseSchema,
};

export type {
	ArrAddBody,
	ArrAddResponse,
	ArrConfigBody,
	ArrConnectionResponse,
	ArrLookupBody,
	ArrLookupResult,
	ArrOptionsResponse,
	ArrServiceType,
	ArrTestConnectionBody,
	ArrTestConnectionResponse,
};
