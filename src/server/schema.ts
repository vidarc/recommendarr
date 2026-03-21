import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
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

export {
	insertSessionSchema,
	insertSettingSchema,
	insertUserSchema,
	selectSessionSchema,
	selectSettingSchema,
	selectUserSchema,
	sessions,
	settings,
	users,
};
