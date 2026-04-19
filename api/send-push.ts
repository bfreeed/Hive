import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { supabaseAdmin, requirePost } from './_lib/auth.js';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT ?? 'mailto:admin@hivenow.app',
  process.env.VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? ''
);

/**
 * POST /api/send-push
 * Body: { userIds: string[], title: string, body: string, url?: string, tag?: string }
 *
 * Looks up push subscriptions for the given user IDs and fires a web push
 * notification to each subscribed device. Called by the client when a message
 * is sent so recipients get notified even if the app is in the background.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const { userIds, title, body, url, tag } = req.body as {
    userIds: string[];
    title: string;
    body: string;
    url?: string;
    tag?: string;
  };

  if (!userIds?.length || !title || !body) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  // Fetch push subscriptions for all target users (service role bypasses RLS)
  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('subscription')
    .in('user_id', userIds);

  if (error) {
    console.error('push_subscriptions query error:', error);
    res.status(500).json({ error: 'DB error' });
    return;
  }

  const payload = JSON.stringify({ title, body, url: url ?? '/#messages', tag });

  const results = await Promise.allSettled(
    (subs ?? []).map(({ subscription }) =>
      webpush.sendNotification(subscription as webpush.PushSubscription, payload)
    )
  );

  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed > 0) console.warn(`${failed} push notification(s) failed`);

  res.status(200).json({ sent: results.length - failed, failed });
}
