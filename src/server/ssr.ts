import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { FastifyInstance } from "fastify";

const isDev = process.env["NODE_ENV"] === "development";

const ssrRoutes = async (app: FastifyInstance) => {
  const root = resolve(import.meta.dirname, "../..");

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");

    const vite = await createViteServer({
      root: resolve(root, "src/client"),
      server: { middlewareMode: true },
      appType: "custom",
    });

    await app.register(import("@fastify/middie"));
    app.use(vite.middlewares);

    app.get("/*", async (_request, reply) => {
      const url = _request.url;
      const templatePath = resolve(root, "src/client/index.html");
      let template = await readFile(templatePath, "utf-8");
      template = await vite.transformIndexHtml(url, template);

      const { render } = (await vite.ssrLoadModule(
        resolve(root, "src/client/entry-server.tsx"),
      )) as { render: () => string };

      const appHtml = render();
      const html = template.replace("<!--ssr-outlet-->", appHtml);

      return reply.type("text/html").send(html);
    });
  } else {
    const clientDist = resolve(root, "dist/client");

    await app.register(import("@fastify/static"), {
      root: resolve(clientDist, "assets"),
      prefix: "/assets/",
      decorateReply: false,
    });

    const templatePath = resolve(clientDist, "index.html");
    const template = await readFile(templatePath, "utf-8");

    const { render } = (await import(
      resolve(root, "dist/ssr/entry-server.js")
    )) as {
      render: () => string;
    };

    app.get("/*", async (_request, reply) => {
      const appHtml = render();
      const html = template.replace("<!--ssr-outlet-->", appHtml);

      return reply.type("text/html").send(html);
    });
  }
};

export { ssrRoutes };
