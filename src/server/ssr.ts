import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { FastifyInstance } from "fastify";

const isDev = process.env["NODE_ENV"] === "development";

const ssrRoutes = async (app: FastifyInstance) => {
	const root = resolve(import.meta.dirname, "../..");

	if (isDev) {
		const { createServer: createViteServer } = await import("vite");

		const vite = await createViteServer({
			appType: "custom",
			configFile: resolve(root, "vite.config.ts"),
			root: resolve(root, "src/client"),
			server: { middlewareMode: true },
		});

		await app.register(import("@fastify/middie"));
		app.use(vite.middlewares);

		app.get("/*", async (_request, reply) => {
			const { url } = _request;
			const templatePath = resolve(root, "src/client/index.html");
			let template = await readFile(templatePath, "utf8");
			template = await vite.transformIndexHtml(url, template);

			const mod: Record<string, unknown> = await vite.ssrLoadModule(
				resolve(root, "src/client/entry-server.tsx"),
			);
			const renderFn: unknown = mod["render"];
			if (typeof renderFn !== "function") {
				throw new Error("SSR module missing render function");
			}

			const appHtml: unknown = renderFn(url);
			if (typeof appHtml !== "string") {
				throw new Error("SSR render must return a string");
			}

			const html = template.replace("<!--ssr-outlet-->", appHtml);

			return reply.type("text/html").send(html);
		});
	} else {
		const clientDist = resolve(root, "dist/client");

		await app.register(import("@fastify/static"), {
			decorateReply: false,
			prefix: "/assets/",
			root: resolve(clientDist, "assets"),
		});

		const templatePath = resolve(clientDist, "index.html");
		const template = await readFile(templatePath, "utf8");

		const mod: Record<string, unknown> = await import(resolve(root, "dist/ssr/entry-server.js"));
		const renderFn: unknown = mod["render"];
		if (typeof renderFn !== "function") {
			throw new Error("SSR module missing render function");
		}

		app.get("/*", async (_request, reply) => {
			const appHtml: unknown = renderFn(_request.url);
			if (typeof appHtml !== "string") {
				throw new Error("SSR render must return a string");
			}

			const html = template.replace("<!--ssr-outlet-->", appHtml);

			return reply.type("text/html").send(html);
		});
	}
};

export { ssrRoutes };
