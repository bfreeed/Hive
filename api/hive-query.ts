import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, requirePost } from './_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const ctx = await getUserSettings(req, res);
  if (!ctx) return;

  const apiKey = ctx.settings?.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'No Anthropic API key configured. Add it in Settings.' });

  const { question, tasks, meetings, projects, today } = req.body;

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
  if (!resp.ok) return res.status(500).json({ error: apiData.error?.message });
  return res.json({ answer: apiData.content?.[0]?.text ?? 'No response.' });
}
