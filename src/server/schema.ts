import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
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

export {
	aiConfigs,
	insertAiConfigSchema,
	insertPlexConnectionSchema,
	insertSessionSchema,
	insertSettingSchema,
	insertUserSchema,
	plexConnections,
	selectAiConfigSchema,
	selectPlexConnectionSchema,
	selectSessionSchema,
	selectSettingSchema,
	selectUserSchema,
	sessions,
	settings,
	users,
};
