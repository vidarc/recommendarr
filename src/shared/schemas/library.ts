import { z } from "zod";

const librarySyncIntervalSchema = z.enum(["manual", "6h", "12h", "24h", "7d"]);

const libraryStatusSchema = z.object({
	lastSynced: z.string().optional(),
	interval: librarySyncIntervalSchema,
	itemCount: z.number(),
	movieCount: z.number(),
	showCount: z.number(),
	excludeDefault: z.boolean(),
});

const librarySyncResponseSchema = z.object({
	movieCount: z.number(),
	showCount: z.number(),
	totalCount: z.number(),
});

const librarySettingsBodySchema = z.object({
	interval: librarySyncIntervalSchema,
	excludeDefault: z.boolean(),
});

type LibrarySyncInterval = z.infer<typeof librarySyncIntervalSchema>;
type LibraryStatus = z.infer<typeof libraryStatusSchema>;
type LibrarySyncResponse = z.infer<typeof librarySyncResponseSchema>;
type LibrarySettingsBody = z.infer<typeof librarySettingsBodySchema>;

export {
	librarySettingsBodySchema,
	libraryStatusSchema,
	librarySyncIntervalSchema,
	librarySyncResponseSchema,
};
export type { LibrarySettingsBody, LibraryStatus, LibrarySyncInterval, LibrarySyncResponse };
