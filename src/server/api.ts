import type { FastifyInstance } from "fastify";

interface SettingRow {
	key: string;
	value: string;
}

const apiRoutes = (app: FastifyInstance) => {
	app.get("/api/settings", async () => {
		const rows = app.db.prepare("SELECT key, value FROM settings").all() as SettingRow[];

		const settings: Record<string, string> = {};
		for (const row of rows) {
			settings[row.key] = row.value;
		}

		return settings;
	});
};

export { apiRoutes };
