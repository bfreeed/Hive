import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, requirePost } from './lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const ctx = await getUserSettings(req, res);
  if (!ctx) return;

  const token = process.env.PUSHOVER_API_TOKEN;
  if (!token) return res.status(503).json({ error: 'PUSHOVER_API_TOKEN not configured' });

  const { userKey, title, message, url, urlTitle } = req.body;
  const body: Record<string, string> = { token, user: userKey, title, message };
  if (url) body.url = url;
  if (urlTitle) body.url_title = urlTitle;

  const resp = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  return res.status(resp.ok ? 200 : 500).json(data);
}
