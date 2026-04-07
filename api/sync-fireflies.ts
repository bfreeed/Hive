import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, requirePost } from './_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const ctx = await getUserSettings(req, res);
  if (!ctx) return;

  const apiKey: string = ctx.settings?.fireflies_api_key || '';
  if (!apiKey) {
    return res.status(503).json({ error: 'No Fireflies API key configured. Add it in Settings → Integrations.' });
  }

  const { since, limit } = req.body;
  const safeLimit = Math.min(limit ?? 30, 50);

  // Build GraphQL query for Fireflies transcripts
  const query = `
    query Transcripts($fromDate: DateTime, $limit: Int) {
      transcripts(fromDate: $fromDate, limit: $limit) {
        id
        title
        date
        duration
        participants
        speakers {
          name
        }
        summary {
          action_items
          overview
          short_summary
        }
        sentences {
          speaker_name
          text
        }
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
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!ffRes.ok) {
    const errText = await ffRes.text();
    return res.status(ffRes.status).json({ error: `Fireflies API error ${ffRes.status}: ${errText}` });
  }

  const ffData = await ffRes.json() as { data?: { transcripts?: any[] }; errors?: any[] };

  if (ffData.errors?.length) {
    return res.status(400).json({ error: `Fireflies GraphQL error: ${JSON.stringify(ffData.errors)}` });
  }

  const transcripts: any[] = ffData.data?.transcripts ?? [];

  const normalized = transcripts.map((t: any) => {
    // Build transcript text from sentences
    const transcriptText = (t.sentences ?? [])
      .map((s: any) => `${s.speaker_name}: ${s.text}`)
      .join('\n');

    // Extract participant names from speakers and participants fields
    const speakerNames: string[] = (t.speakers ?? []).map((s: any) => s.name).filter(Boolean);
    const participantEmails: string[] = Array.isArray(t.participants) ? t.participants.filter(Boolean) : [];
    // Use speaker names, falling back to email local parts if no speakers
    const participantNames = speakerNames.length > 0
      ? speakerNames
      : participantEmails.map(e => e.split('@')[0]);

    return {
      externalId: t.id,
      provider: 'fireflies' as const,
      title: t.title ?? 'Untitled meeting',
      date: t.date ? new Date(t.date).toISOString() : new Date().toISOString(),
      notes: t.summary?.overview ?? t.summary?.short_summary ?? '',
      transcript: transcriptText,
      summary: t.summary?.short_summary ?? '',
      participantNames,
      participantEmails,
    };
  });

  return res.json({ notes: normalized, count: normalized.length });
}
