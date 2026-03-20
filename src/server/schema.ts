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

export {
	insertSettingSchema,
	insertUserSchema,
	selectSettingSchema,
	selectUserSchema,
	settings,
	users,
};
