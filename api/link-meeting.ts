import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, requirePost } from './_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const ctx = await getUserSettings(req, res);
  if (!ctx) return;

  const apiKey = ctx.settings?.anthropic_api_key;
  if (!apiKey) return res.status(503).json({ error: 'No Anthropic API key configured. Add it in Settings.' });

  const { meetingId, title, notes, transcript, projects } = req.body;
  const projectList = (projects as Array<{ id: string; name: string }>).map(p => `${p.id}: ${p.name}`).join('\n');
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
- actionItems: up to 10, extract concrete next steps for ALL participants — always include the assignee name; if unclear, set assignee to null
- Return empty arrays if nothing fits, never fabricate`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 512, messages: [{ role: 'user', content: prompt }] }),
  });

  const apiData = await resp.json() as { content?: Array<{ text?: string }>; error?: { message: string } };
  if (!resp.ok) return res.status(500).json({ error: apiData.error?.message || 'Claude API error' });

  const raw = (apiData.content?.[0]?.text || '{}')
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(raw);

  return res.json({
    meetingId,
    linkedProjectIds: parsed.highConfidenceProjectIds ?? [],
    suggestedProjectIds: parsed.lowConfidenceProjectIds ?? [],
    actionItems: (parsed.actionItems ?? []).slice(0, 10).map((a: { text: string; assignee?: string | null }, i: number) => ({
      id: `ai-${meetingId}-${i}`,
      text: a.text,
      assignee: a.assignee ?? undefined,
      accepted: false,
      dismissed: false,
    })),
  });
}
