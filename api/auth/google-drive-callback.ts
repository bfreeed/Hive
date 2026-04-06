import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/auth';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const APP_URL = process.env.APP_URL || 'https://hivenow.app';
const REDIRECT_URI = `${APP_URL}/api/auth/google-drive-callback`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${APP_URL}?drive_error=${encodeURIComponent(String(error))}`);
  }

  if (!code || !state) {
    return res.redirect(`${APP_URL}?drive_error=missing_params`);
  }

  // Look up user by state
  const { data: settings } = await supabaseAdmin
    .from('user_settings')
    .select('user_id')
    .eq('google_oauth_state', String(state))
    .maybeSingle();

  if (!settings) {
    return res.redirect(`${APP_URL}?drive_error=invalid_state`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: String(code),
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!tokenRes.ok || !tokens.access_token) {
    return res.redirect(`${APP_URL}?drive_error=${encodeURIComponent(tokens.error || 'token_exchange_failed')}`);
  }

  const expiry = Date.now() + (tokens.expires_in ?? 3600) * 1000 - 60_000;

  const update: Record<string, unknown> = {
    google_drive_access_token: tokens.access_token,
    google_drive_token_expiry: expiry,
    google_oauth_state: null,
  };
  if (tokens.refresh_token) {
    update.google_drive_refresh_token = tokens.refresh_token;
  }

  await supabaseAdmin
    .from('user_settings')
    .update(update)
    .eq('user_id', settings.user_id);

  // Redirect back to app — client will detect drive_connected=1 and reload files
  res.redirect(`${APP_URL}?drive_connected=1`);
}
