import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, supabaseAdmin } from '../_lib/auth';
import { randomBytes } from 'crypto';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const APP_URL = process.env.APP_URL || 'https://hivenow.app';
const REDIRECT_URI = `${APP_URL}/api/auth/google-drive-callback`;
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ctx = await getUserSettings(req, res);
  if (!ctx) return;

  // Generate random state and store it so the callback can look up the user
  const state = randomBytes(32).toString('hex');
  await supabaseAdmin
    .from('user_settings')
    .update({ google_oauth_state: state })
    .eq('user_id', ctx.user.id);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // always return refresh_token
    state,
  });

  res.status(200).json({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
}
