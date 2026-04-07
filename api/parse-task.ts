import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, requirePost } from './_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const ctx = await getUserSettings(req, res);
  if (!ctx) return;

  const apiKey = ctx.settings?.anthropic_api_key;
  if (!apiKey) {
    return res.status(503).json({ error: 'No Anthropic API key configured. Add it in Settings.' });
  }

  const { text, projects, users, today } = req.body;
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
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 256, messages: [{ role: 'user', content: prompt }] }),
  });

  const apiData = await resp.json() as { content?: Array<{ text?: string }>; error?: { message: string } };
  if (!resp.ok) return res.status(500).json({ error: apiData.error?.message || 'Claude API error' });

  const raw = (apiData.content?.[0]?.text || '{}')
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  return res.json(JSON.parse(raw));
}
