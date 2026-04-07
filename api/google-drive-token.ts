import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, supabaseAdmin } from './_lib/auth.js';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end();

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({ error: 'Server missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET env vars' });
    }

    const ctx = await getUserSettings(req, res);
    if (!ctx) return;

    const { settings, user } = ctx;

    if (!settings?.google_drive_access_token) {
      return res.status(200).json({ connected: false });
    }

    const expiry = settings.google_drive_token_expiry ?? 0;
    if (Date.now() < expiry) {
      return res.status(200).json({ connected: true, token: settings.google_drive_access_token });
    }

    if (!settings.google_drive_refresh_token) {
      return res.status(200).json({ connected: false });
    }

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

    if (!refreshRes.ok || !tokens.access_token) {
      await supabaseAdmin
        .from('user_settings')
        .update({ google_drive_access_token: null, google_drive_token_expiry: null })
        .eq('user_id', user.id);
      return res.status(200).json({ connected: false });
    }

    const newExpiry = Date.now() + (tokens.expires_in ?? 3600) * 1000 - 60_000;
    await supabaseAdmin
      .from('user_settings')
      .update({ google_drive_access_token: tokens.access_token, google_drive_token_expiry: newExpiry })
      .eq('user_id', user.id);

    return res.status(200).json({ connected: true, token: tokens.access_token });
  } catch (err: any) {
    console.error('google-drive-token crash:', err);
    return res.status(500).json({ error: err?.message ?? 'Unknown server error', stack: err?.stack?.split('\n').slice(0, 3) });
  }
}
