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
      // -----------------------------------------------------------------------
      // Granola sync proxy — keeps API key server-side
      // POST /api/sync-granola  { apiKey, since? }
      // Returns: NormalizedNote[]
      // -----------------------------------------------------------------------
      {
        name: 'granola-sync',
        configureServer(server) {
          server.middlewares.use('/api/sync-granola', (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', async () => {
              try {
                const body = JSON.parse(Buffer.concat(chunks).toString());
                // API key: prefer per-request key (user stored in DB), fall back to env
                const apiKey: string = body.apiKey || env.GRANOLA_API_KEY || '';
                if (!apiKey) {
                  res.statusCode = 503;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'No Granola API key configured. Add it in Settings → Integrations or set GRANOLA_API_KEY in .env' }));
                  return;
                }

                // Build query params — official Granola public API uses updated_after + cursor
                const params = new URLSearchParams();
                // Only set updated_after if since is a valid non-null, non-empty ISO string
                // Normalize to UTC Z format — Granola rejects +00:00 offset notation
                if (body.since != null && typeof body.since === 'string' && body.since.trim().length > 0) {
                  const sinceDate = new Date(body.since.trim());
                  if (!isNaN(sinceDate.getTime())) {
                    params.set('updated_after', sinceDate.toISOString());
                  }
                }
                params.set('page_size', String(Math.min(body.limit ?? 30, 30))); // max 30 per docs

                const granolaRes = await fetch(`https://public-api.granola.ai/v1/notes?${params}`, {
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                  },
                });

                if (!granolaRes.ok) {
                  const errText = await granolaRes.text();
                  res.statusCode = granolaRes.status;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: `Granola API error ${granolaRes.status}: ${errText}` }));
                  return;
                }

                const granolaData = await granolaRes.json() as { notes?: any[] };
                const summaries: any[] = granolaData.notes ?? [];

                // Fetch full detail for each note (summary endpoint omits notes content)
                const detailed = await Promise.all(
                  summaries.map(async (n: any) => {
                    try {
                      const detailRes = await fetch(
                        `https://public-api.granola.ai/v1/notes/${n.id}`,
                        { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
                      );
                      if (detailRes.ok) return await detailRes.json();
                    } catch {}
                    return n; // fall back to summary if detail fetch fails
                  })
                );

                // Normalize to our NormalizedNote shape using official API field names
                const normalized = detailed.map((n: any) => ({
                  externalId: n.id,
                  provider: 'granola' as const,
                  title: n.title ?? n.calendar_event?.title ?? 'Untitled meeting',
                  date: n.calendar_event?.start_time ?? n.created_at ?? new Date().toISOString(),
                  notes: n.summary_markdown ?? n.summary_text ?? '',
                  transcript: '',
                  summary: n.summary_text ?? '',
                  participantNames: (n.attendees ?? []).map((p: any) => p.name ?? '').filter(Boolean),
                  participantEmails: (n.attendees ?? []).map((p: any) => p.email ?? '').filter(Boolean),
                }));

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ notes: normalized, count: normalized.length }));
              } catch (err: unknown) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
              }
            });
          });
        },
      },

      // -----------------------------------------------------------------------
      // Meeting AI linker — project matching + action item extraction
      // POST /api/link-meeting  { meetingId, title, notes, transcript, projects }
      // Returns: { linkedProjectIds, suggestedProjectIds, actionItems }
      // -----------------------------------------------------------------------
      {
        name: 'meeting-linker',
        configureServer(server) {
          server.middlewares.use('/api/link-meeting', (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', async () => {
              try {
                const { meetingId, title, notes, transcript, projects } = JSON.parse(Buffer.concat(chunks).toString());
                const apiKey = env.ANTHROPIC_API_KEY;
                if (!apiKey) {
                  res.statusCode = 503;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in .env' }));
                  return;
                }

                const projectList = (projects as Array<{ id: string; name: string }>)
                  .map(p => `${p.id}: ${p.name}`)
                  .join('\n');

                const content = [title, notes, transcript].filter(Boolean).join('\n\n').slice(0, 8000);

                const prompt = `You are a meeting analyzer. Analyze this meeting and return structured JSON.

PROJECTS AVAILABLE (id: name):
${projectList || '(none)'}

MEETING CONTENT:
${content}

Return ONLY valid JSON (no markdown, no explanation):
{
  "highConfidenceProjectIds": ["IDs of projects clearly discussed — require strong evidence"],
  "lowConfidenceProjectIds": ["IDs that may be related — weak signal"],
  "actionItems": [
    { "text": "concise action item", "assignee": "person name or null" }
  ]
}

Rules:
- highConfidenceProjectIds: project was explicitly named or clearly the main topic
- lowConfidenceProjectIds: project name wasn't mentioned but meeting clearly relates to it
- actionItems: max 5, concrete next steps with a clear owner, skip vague commitments
- Return empty arrays if nothing fits, never fabricate`;

                const resp = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                  },
                  body: JSON.stringify({
                    model: 'claude-haiku-4-5',
                    max_tokens: 512,
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
                res.end(JSON.stringify({
                  meetingId,
                  linkedProjectIds: parsed.highConfidenceProjectIds ?? [],
                  suggestedProjectIds: parsed.lowConfidenceProjectIds ?? [],
                  actionItems: (parsed.actionItems ?? []).slice(0, 5).map((a: { text: string; assignee?: string | null }, i: number) => ({
                    id: `ai-${meetingId}-${i}`,
                    text: a.text,
                    accepted: false,
                    dismissed: false,
                  })),
                }));
              } catch (err: unknown) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
              }
            });
          });
        },
      },

      // -----------------------------------------------------------------------
      // Hive Query — natural language Q&A across tasks, meetings, projects
      // POST /api/hive-query  { question, tasks, meetings, projects, today }
      // Returns: { answer }
      // -----------------------------------------------------------------------
      {
        name: 'hive-query',
        configureServer(server) {
          server.middlewares.use('/api/hive-query', (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', async () => {
              try {
                const { question, tasks, meetings, projects, today } = JSON.parse(Buffer.concat(chunks).toString());
                const apiKey = env.ANTHROPIC_API_KEY;
                if (!apiKey) { res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' })); return; }

                const prompt = `You are an assistant for a personal task OS called Hive. Answer the user's question using only the data provided. Be concise and well-formatted using plain text (no markdown headers or bold). Today is ${today}.

PROJECTS: ${JSON.stringify(projects)}
TASKS: ${JSON.stringify(tasks)}
MEETINGS: ${JSON.stringify(meetings)}

Question: "${question}"`;

                const resp = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
                  body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
                });
                const apiData = await resp.json() as { content?: Array<{ text?: string }>; error?: { message: string } };
                if (!resp.ok) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: apiData.error?.message })); return; }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ answer: apiData.content?.[0]?.text ?? 'No response.' }));
              } catch (err: unknown) {
                res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
              }
            });
          });
        },
      },

      // -----------------------------------------------------------------------
      // Layout Command — natural language Home section rearrangement
      // POST /api/layout-command  { command, sections }
      // Returns: { sections, message }
      // -----------------------------------------------------------------------
      {
        name: 'layout-command',
        configureServer(server) {
          server.middlewares.use('/api/layout-command', (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', async () => {
              try {
                const { command, sections } = JSON.parse(Buffer.concat(chunks).toString());
                const apiKey = env.ANTHROPIC_API_KEY;
                if (!apiKey) { res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' })); return; }

                const prompt = `You manage the Home page layout for a personal task OS. The user wants to change which sections are shown and in what order.

Current sections (in order): ${JSON.stringify(sections)}

User command: "${command}"

Section IDs that exist: inbox, unreviewed_meetings, within_72h, overdue, today, high_priority, upcoming, questions, sarahs_updates

Rules:
- You can enable/disable sections (set enabled: true/false)
- You can reorder sections by changing their position in the array
- Never remove sections from the array, only toggle enabled
- The label field must not change

Return ONLY valid JSON:
{
  "sections": [...updated sections array...],
  "message": "one sentence confirming what changed"
}`;

                const resp = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
                  body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 512, messages: [{ role: 'user', content: prompt }] }),
                });
                const apiData = await resp.json() as { content?: Array<{ text?: string }>; error?: { message: string } };
                if (!resp.ok) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: apiData.error?.message })); return; }
                const raw = (apiData.content?.[0]?.text ?? '{}').replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
                const parsed = JSON.parse(raw);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(parsed));
              } catch (err: unknown) {
                res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
              }
            });
          });
        },
      },

      // -----------------------------------------------------------------------
      // Meeting Intelligence — natural language Q&A across all meeting data
      // POST /api/meeting-intelligence  { question, meetings, users }
      // Returns: { answer }
      // -----------------------------------------------------------------------
      {
        name: 'meeting-intelligence',
        configureServer(server) {
          server.middlewares.use('/api/meeting-intelligence', (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', async () => {
              try {
                const { question, meetings, users } = JSON.parse(Buffer.concat(chunks).toString());
                const apiKey = env.ANTHROPIC_API_KEY;
                if (!apiKey) {
                  res.statusCode = 503;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in .env' }));
                  return;
                }

                const prompt = `You are an assistant helping a user query their meeting notes and action items.
The user has the following team members: ${users}

Here is their meeting data (JSON):
${JSON.stringify(meetings, null, 2)}

The user asks: "${question}"

Instructions:
- Answer clearly and concisely using only the data provided
- Format your response in plain text — use line breaks, dashes, and indentation for structure (no markdown headers or bold)
- For action item queries, group by meeting and clearly distinguish between items added to tasks (addedToTasks: true) and items not yet added (addedToTasks: false)
- For date-based queries like "this week", use the meeting dates in the data
- If the data doesn't contain enough information to answer, say so clearly`;

                const resp = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                  },
                  body: JSON.stringify({
                    model: 'claude-opus-4-5',
                    max_tokens: 1024,
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

                const answer = apiData.content?.[0]?.text ?? 'No response.';
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ answer }));
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
