import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, requirePost } from './_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const ctx = await getUserSettings(req, res);
  if (!ctx) return;

  const apiKey: string = ctx.settings?.granola_api_key || '';
  if (!apiKey) {
    return res.status(503).json({ error: 'No Granola API key configured. Add it in Settings → Integrations.' });
  }

  const { since, limit } = req.body;
  const params = new URLSearchParams();
  if (since != null && typeof since === 'string' && since.trim().length > 0) {
    const sinceDate = new Date(since.trim());
    if (!isNaN(sinceDate.getTime())) params.set('updated_after', sinceDate.toISOString());
  }
  params.set('page_size', String(Math.min(limit ?? 30, 30)));

  const granolaRes = await fetch(`https://public-api.granola.ai/v1/notes?${params}`, {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });

  if (!granolaRes.ok) {
    const errText = await granolaRes.text();
    return res.status(granolaRes.status).json({ error: `Granola API error ${granolaRes.status}: ${errText}` });
  }

  const granolaData = await granolaRes.json() as { notes?: any[] };
  const summaries: any[] = granolaData.notes ?? [];

  const detailed = await Promise.all(
    summaries.map(async (n: any) => {
      try {
        const detailRes = await fetch(
          `https://public-api.granola.ai/v1/notes/${n.id}`,
          { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
        );
        if (detailRes.ok) return await detailRes.json();
      } catch {}
      return n;
    })
  );

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

  return res.json({ notes: normalized, count: normalized.length });
}
