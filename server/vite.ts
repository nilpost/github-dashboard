import { createServer as createViteServer } from "vite";
import type { ViteDevServer } from "vite";
import type { Request, Response } from "express";

let vite: ViteDevServer;

export async function setupVite(app: any) {
  vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  app.use(vite.middlewares);

  // Handle SPA fallback
  app.get("*", async (req: Request, res: Response) => {
    try {
      const url = req.originalUrl;
      const html = await vite.transformIndexHtml(url, `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>GitHub Dashboard</title>
          </head>
          <body>
            <div id="root"></div>
            <script type="module" src="/client/index.tsx"></script>
          </body>
        </html>
      `);
      res.type("text/html").send(html);
    } catch (e: any) {
      vite.ssrFixStacktrace(e);
      res.status(500).end(e.message);
    }
  });
}
