import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, requirePost } from './_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const ctx = await getUserSettings(req, res);
  if (!ctx) return;

  const apiKey = ctx.settings?.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'No Anthropic API key configured. Add it in Settings.' });

  const { question, meetings, users } = req.body;

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
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
  });

  const apiData = await resp.json() as { content?: Array<{ text?: string }>; error?: { message: string } };
  if (!resp.ok) return res.status(500).json({ error: apiData.error?.message || 'Claude API error' });
  return res.json({ answer: apiData.content?.[0]?.text ?? 'No response.' });
}
