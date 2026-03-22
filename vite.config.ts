import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'http'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'pushover-notify',
        configureServer(server) {
          server.middlewares.use('/api/send-notification', (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', async () => {
              try {
                const { userKey, title, message, url, urlTitle } = JSON.parse(Buffer.concat(chunks).toString());
                const token = env.PUSHOVER_API_TOKEN;
                if (!token) {
                  res.statusCode = 503;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'PUSHOVER_API_TOKEN not configured in .env' }));
                  return;
                }
                const body: Record<string, string> = { token, user: userKey, title, message };
                if (url) body.url = url;
                if (urlTitle) body.url_title = urlTitle;

                const resp = await fetch('https://api.pushover.net/1/messages.json', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                });
                const data = await resp.json();
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = resp.ok ? 200 : 500;
                res.end(JSON.stringify(data));
              } catch (err: unknown) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
              }
            });
          });
        },
      },
    ],
  };
});
