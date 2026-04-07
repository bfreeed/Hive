import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, requirePost } from './_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const ctx = await getUserSettings(req, res);
  if (!ctx) return;

  const apiKey = ctx.settings?.anthropic_api_key;
  if (!apiKey) return res.status(503).json({ error: 'No Anthropic API key configured. Add it in Settings.' });

  const { command, sections } = req.body;

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
  if (!resp.ok) return res.status(500).json({ error: apiData.error?.message });

  const raw = (apiData.content?.[0]?.text ?? '{}')
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  return res.json(JSON.parse(raw));
}
