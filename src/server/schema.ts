import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";

const settings = sqliteTable("settings", {
	key: text("key").primaryKey(),
	value: text("value"),
});

const selectSettingSchema = createSelectSchema(settings);
const insertSettingSchema = createInsertSchema(settings);

export { insertSettingSchema, selectSettingSchema, settings };
