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
      {
        name: 'claude-parse-task',
        configureServer(server) {
          server.middlewares.use('/api/parse-task', (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', async () => {
              try {
                const { text, projects, users, today } = JSON.parse(Buffer.concat(chunks).toString());
                const apiKey = env.ANTHROPIC_API_KEY;
                if (!apiKey) {
                  res.statusCode = 503;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in .env' }));
                  return;
                }

                const projectList = (projects || []).map((p: { id: string; name: string }) => `${p.id}: ${p.name}`).join('\n');
                const userList = (users || []).map((u: { id: string; name: string }) => `${u.id}: ${u.name}`).join('\n');

                const prompt = `You are a task parser. Parse the following natural language into structured task data.
Return ONLY valid JSON, no markdown, no explanation.

Today is ${today}.

Available projects (id: name):
${projectList || '(none)'}

Available team members (id: name):
${userList || '(none)'}

Input: "${text}"

Rules:
- assigneeIds: ONLY populate if the user explicitly delegates ("assign to X", "for X", "X should do this", "X's task"). Do NOT assign just because a person's name appears in the task (e.g. "call Sarah" means call Sarah, not assign to Sarah).
- projectIds: populate if the user mentions a project name or clear context match.
- reminderAt: only if the user explicitly says "remind me".
- priority: only if the user says urgent/high/important/asap/low.

Return JSON with these fields:
{
  "title": "string (required, clean task title)",
  "dueDate": "YYYY-MM-DD or null",
  "dueTime": "HH:MM (24h) or null",
  "reminderAt": "ISO 8601 datetime or null",
  "priority": "urgent|high|normal|low or null",
  "assigneeIds": ["matched user IDs — only if explicitly assigned"],
  "projectIds": ["matched project IDs"]
}`;

                const resp = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                  },
                  body: JSON.stringify({
                    model: 'claude-haiku-4-5',
                    max_tokens: 256,
                    messages: [{ role: 'user', content: prompt }],
                  }),
                });

                const apiData = await resp.json() as { content?: Array<{ text?: string }>; error?: { message: string } };
                if (!resp.ok) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: apiData.error?.message || 'Claude API error' }));
                  return;
                }

                const raw = (apiData.content?.[0]?.text || '{}')
                  .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
                const parsed = JSON.parse(raw);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(parsed));
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
