import closeWithGrace from "close-with-grace";

import { buildServer } from "./app.ts";

const server = await buildServer();

closeWithGrace(async function ({ signal, err }) {
	if (err) {
		server.log.error({ err }, "server closing with error");
	} else {
		server.log.info(`${signal} received, server closing`);
	}
	await server.close();
});

const port = process.env["PORT"] ? Number(process.env["PORT"]) : 3000;
const host = process.env["HOST"] ?? "0.0.0.0";

await server.listen({ host, port });
