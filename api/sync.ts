import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, requirePost } from './_lib/auth.js';

/**
 * POST /api/sync
 * Body: { service: 'granola' | 'fireflies', since?: string, limit?: number }
 *
 * Consolidated sync endpoint replacing /api/sync-granola and /api/sync-fireflies.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const ctx = await getUserSettings(req, res);
  if (!ctx) return;

  const { service, since, limit } = req.body as { service: string; since?: string; limit?: number };

  if (service === 'granola') {
    const apiKey: string = ctx.settings?.granola_api_key || '';
    if (!apiKey) return res.status(503).json({ error: 'No Granola API key configured. Add it in Settings → Integrations.' });

    const params = new URLSearchParams();
    if (since != null && typeof since === 'string' && since.trim().length > 0) {
      const sinceDate = new Date(since.trim());
      if (!isNaN(sinceDate.getTime())) params.set('updated_after', sinceDate.toISOString());
    }
    params.set('page_size', String(Math.min(limit ?? 30, 30)));

    const granolaRes = await fetch(`https://public-api.granola.ai/v1/notes?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    if (!granolaRes.ok) {
      const errText = await granolaRes.text();
      return res.status(granolaRes.status).json({ error: `Granola API error ${granolaRes.status}: ${errText}` });
    }

    const granolaData = await granolaRes.json() as { notes?: any[] };
    const detailed = await Promise.all(
      (granolaData.notes ?? []).map(async (n: any) => {
        try {
          const detailRes = await fetch(`https://public-api.granola.ai/v1/notes/${n.id}`, {
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          });
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

  if (service === 'fireflies') {
    const apiKey: string = ctx.settings?.fireflies_api_key || '';
    if (!apiKey) return res.status(503).json({ error: 'No Fireflies API key configured. Add it in Settings → Integrations.' });

    const safeLimit = Math.min(limit ?? 30, 50);
    const query = `
      query Transcripts($fromDate: DateTime, $limit: Int) {
        transcripts(fromDate: $fromDate, limit: $limit) {
          id title date duration participants
          speakers { name }
          summary { action_items overview short_summary }
          sentences { speaker_name text }
        }
      }
    `;
    const variables: Record<string, any> = { limit: safeLimit };
    if (since != null && typeof since === 'string' && since.trim().length > 0) {
      const sinceDate = new Date(since.trim());
      if (!isNaN(sinceDate.getTime())) variables.fromDate = sinceDate.toISOString();
    }

    const ffRes = await fetch('https://api.fireflies.ai/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!ffRes.ok) {
      const errText = await ffRes.text();
      return res.status(ffRes.status).json({ error: `Fireflies API error ${ffRes.status}: ${errText}` });
    }

    const ffData = await ffRes.json() as { data?: { transcripts?: any[] }; errors?: any[] };
    if (ffData.errors?.length) return res.status(400).json({ error: `Fireflies GraphQL error: ${JSON.stringify(ffData.errors)}` });

    const normalized = (ffData.data?.transcripts ?? []).map((t: any) => {
      const transcriptText = (t.sentences ?? []).map((s: any) => `${s.speaker_name}: ${s.text}`).join('\n');
      const speakerNames: string[] = (t.speakers ?? []).map((s: any) => s.name).filter(Boolean);
      const participantEmails: string[] = Array.isArray(t.participants) ? t.participants.filter(Boolean) : [];
      return {
        externalId: t.id,
        provider: 'fireflies' as const,
        title: t.title ?? 'Untitled meeting',
        date: t.date ? new Date(t.date).toISOString() : new Date().toISOString(),
        notes: t.summary?.overview ?? t.summary?.short_summary ?? '',
        transcript: transcriptText,
        summary: t.summary?.short_summary ?? '',
        participantNames: speakerNames.length > 0 ? speakerNames : participantEmails.map(e => e.split('@')[0]),
        participantEmails,
      };
    });

    return res.json({ notes: normalized, count: normalized.length });
  }

  return res.status(400).json({ error: `Unknown service: ${service}` });
}
