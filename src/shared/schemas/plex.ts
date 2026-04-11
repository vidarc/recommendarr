import { z } from "zod";

const MIN_STRING_LENGTH = 1;

const plexAuthStartResponseSchema = z.object({
	pinId: z.number(),
	authUrl: z.string(),
});

const plexAuthCheckQuerySchema = z.object({
	pinId: z.coerce.number(),
});

const plexAuthCheckResponseSchema = z.object({
	claimed: z.boolean(),
});

const plexManualAuthBodySchema = z.object({
	authToken: z.string().min(MIN_STRING_LENGTH),
	serverUrl: z.string().url(),
	serverName: z.string().min(MIN_STRING_LENGTH),
});

const plexServerSchema = z.object({
	name: z.string(),
	address: z.string(),
	port: z.number(),
	scheme: z.string(),
	uri: z.string(),
	clientIdentifier: z.string(),
	owned: z.boolean(),
});

const plexServersResponseSchema = z.object({
	servers: z.array(plexServerSchema),
});

const plexSelectServerBodySchema = z.object({
	serverUrl: z.string().url(),
	serverName: z.string(),
	machineIdentifier: z.string(),
});

const plexLibrarySchema = z.object({
	key: z.string(),
	title: z.string(),
	type: z.string(),
});

const plexLibrariesResponseSchema = z.object({
	libraries: z.array(plexLibrarySchema),
});

type PlexAuthStartResponse = z.infer<typeof plexAuthStartResponseSchema>;
type PlexAuthCheckResponse = z.infer<typeof plexAuthCheckResponseSchema>;
type PlexManualAuthBody = z.infer<typeof plexManualAuthBodySchema>;
type PlexServer = z.infer<typeof plexServerSchema>;
type PlexServersResponse = z.infer<typeof plexServersResponseSchema>;
type PlexSelectServerBody = z.infer<typeof plexSelectServerBodySchema>;
type PlexLibrary = z.infer<typeof plexLibrarySchema>;
type PlexLibrariesResponse = z.infer<typeof plexLibrariesResponseSchema>;

export {
	plexAuthCheckQuerySchema,
	plexAuthCheckResponseSchema,
	plexAuthStartResponseSchema,
	plexLibrariesResponseSchema,
	plexLibrarySchema,
	plexManualAuthBodySchema,
	plexSelectServerBodySchema,
	plexServerSchema,
	plexServersResponseSchema,
};

export type {
	PlexAuthCheckResponse,
	PlexAuthStartResponse,
	PlexLibrariesResponse,
	PlexLibrary,
	PlexManualAuthBody,
	PlexSelectServerBody,
	PlexServer,
	PlexServersResponse,
};
