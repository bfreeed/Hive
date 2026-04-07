import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, supabaseAdmin } from './_lib/auth';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';

async function getValidToken(settings: Record<string, any>, userId: string): Promise<string | null> {
  if (!settings?.google_drive_access_token) return null;

  const expiry = settings.google_drive_token_expiry ?? 0;
  if (Date.now() < expiry) return settings.google_drive_access_token;

  if (!settings.google_drive_refresh_token) return null;

  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: settings.google_drive_refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokens = await refreshRes.json() as { access_token?: string; expires_in?: number };
  if (!tokens.access_token) return null;

  const newExpiry = Date.now() + (tokens.expires_in ?? 3600) * 1000 - 60_000;
  await supabaseAdmin
    .from('user_settings')
    .update({ google_drive_access_token: tokens.access_token, google_drive_token_expiry: newExpiry })
    .eq('user_id', userId);

  return tokens.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ctx = await getUserSettings(req, res);
  if (!ctx) return;

  const token = await getValidToken(ctx.settings ?? {}, ctx.user.id);
  if (!token) return res.status(200).json({ connected: false });

  const { folderId } = req.body;
  if (!folderId) return res.status(400).json({ error: 'folderId required' });

  const fields = 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size,owners)';
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);

  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${encodeURIComponent(fields)}&orderBy=name&pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!driveRes.ok) {
    if (driveRes.status === 401) {
      await supabaseAdmin
        .from('user_settings')
        .update({ google_drive_access_token: null, google_drive_token_expiry: null })
        .eq('user_id', ctx.user.id);
      return res.status(200).json({ connected: false });
    }
    return res.status(500).json({ error: `Drive API error: ${driveRes.status}` });
  }

  const data = await driveRes.json() as { files?: unknown[] };
  return res.status(200).json({ connected: true, files: data.files ?? [] });
}
