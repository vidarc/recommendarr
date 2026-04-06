import { sql } from "drizzle-orm";
import { check, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";

const settings = sqliteTable("settings", {
	key: text("key").primaryKey(),
	value: text("value"),
});

const selectSettingSchema = createSelectSchema(settings);
const insertSettingSchema = createInsertSchema(settings);

const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	username: text("username").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
	createdAt: text("created_at").notNull(),
});

const selectUserSchema = createSelectSchema(users);
const insertUserSchema = createInsertSchema(users);

const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	createdAt: text("created_at").notNull(),
	expiresAt: text("expires_at").notNull(),
});

const selectSessionSchema = createSelectSchema(sessions);
const insertSessionSchema = createInsertSchema(sessions);

const plexConnections = sqliteTable("plex_connections", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().unique(),
	authToken: text("auth_token").notNull(),
	serverUrl: text("server_url"),
	serverName: text("server_name"),
	machineIdentifier: text("machine_identifier"),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

const selectPlexConnectionSchema = createSelectSchema(plexConnections);
const insertPlexConnectionSchema = createInsertSchema(plexConnections);

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;

const aiConfigs = sqliteTable("ai_configs", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().unique(),
	endpointUrl: text("endpoint_url").notNull(),
	apiKey: text("api_key").notNull(),
	modelName: text("model_name").notNull(),
	temperature: real("temperature").notNull().default(DEFAULT_TEMPERATURE),
	maxTokens: integer("max_tokens").notNull().default(DEFAULT_MAX_TOKENS),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

const selectAiConfigSchema = createSelectSchema(aiConfigs);
const insertAiConfigSchema = createInsertSchema(aiConfigs);

const conversations = sqliteTable("conversations", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	mediaType: text("media_type").notNull(),
	title: text("title"),
	createdAt: text("created_at").notNull(),
});

const selectConversationSchema = createSelectSchema(conversations);
const insertConversationSchema = createInsertSchema(conversations);

const messages = sqliteTable("messages", {
	id: text("id").primaryKey(),
	conversationId: text("conversation_id").notNull(),
	role: text("role").notNull(),
	content: text("content").notNull(),
	createdAt: text("created_at").notNull(),
});

const selectMessageSchema = createSelectSchema(messages);
const insertMessageSchema = createInsertSchema(messages);

const recommendations = sqliteTable(
	"recommendations",
	{
		id: text("id").primaryKey(),
		messageId: text("message_id").notNull(),
		title: text("title").notNull(),
		year: integer("year"),
		mediaType: text("media_type").notNull(),
		synopsis: text("synopsis"),
		tmdbId: integer("tmdb_id"),
		addedToArr: integer("added_to_arr", { mode: "boolean" }).notNull().default(false),
		feedback: text("feedback"),
	},
	(table) => [
		check(
			"feedback_values",
			sql`${table.feedback} IN ('liked', 'disliked') OR ${table.feedback} IS NULL`,
		),
	],
);

const selectRecommendationSchema = createSelectSchema(recommendations);
const insertRecommendationSchema = createInsertSchema(recommendations);

const arrConnections = sqliteTable(
	"arr_connections",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		serviceType: text("service_type").notNull(),
		url: text("url").notNull(),
		apiKey: text("api_key").notNull(),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(table) => [uniqueIndex("arr_user_service_idx").on(table.userId, table.serviceType)],
);

const selectArrConnectionSchema = createSelectSchema(arrConnections);
const insertArrConnectionSchema = createInsertSchema(arrConnections);

const libraryItems = sqliteTable(
	"library_items",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		title: text("title").notNull(),
		year: integer("year"),
		mediaType: text("media_type").notNull(),
		source: text("source").notNull(),
		plexRatingKey: text("plex_rating_key"),
		externalId: text("external_id"),
		genres: text("genres"),
		syncedAt: text("synced_at").notNull(),
	},
	(table) => [
		uniqueIndex("library_user_source_title_year_idx").on(
			table.userId,
			table.source,
			table.title,
			table.year,
		),
	],
);

const selectLibraryItemSchema = createSelectSchema(libraryItems);
const insertLibraryItemSchema = createInsertSchema(libraryItems);

const userSettings = sqliteTable("user_settings", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().unique(),
	librarySyncInterval: text("library_sync_interval").notNull().default("manual"),
	librarySyncLast: text("library_sync_last"),
	excludeLibraryDefault: integer("exclude_library_default", { mode: "boolean" })
		.notNull()
		.default(true),
});

const selectUserSettingsSchema = createSelectSchema(userSettings);
const insertUserSettingsSchema = createInsertSchema(userSettings);

export {
	aiConfigs,
	arrConnections,
	conversations,
	insertAiConfigSchema,
	insertArrConnectionSchema,
	insertConversationSchema,
	insertLibraryItemSchema,
	insertMessageSchema,
	insertPlexConnectionSchema,
	insertRecommendationSchema,
	insertSessionSchema,
	insertSettingSchema,
	insertUserSchema,
	insertUserSettingsSchema,
	libraryItems,
	messages,
	plexConnections,
	recommendations,
	selectAiConfigSchema,
	selectArrConnectionSchema,
	selectConversationSchema,
	selectLibraryItemSchema,
	selectMessageSchema,
	selectPlexConnectionSchema,
	selectRecommendationSchema,
	selectSessionSchema,
	selectSettingSchema,
	selectUserSchema,
	selectUserSettingsSchema,
	sessions,
	settings,
	userSettings,
	users,
};
