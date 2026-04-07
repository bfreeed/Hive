import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, supabaseAdmin, requirePost } from './_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const auth = await getUserSettings(req, res);
  if (!auth) return;
  const { user } = auth;

  const { type, resourceId, resourceName, invitedUserId } = req.body as {
    type: 'project' | 'channel';
    resourceId: string;
    resourceName: string;
    invitedUserId: string;
  };

  if (!type || !resourceId || !resourceName || !invitedUserId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Get inviter's display name
  const { data: inviterProfile } = await supabaseAdmin
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();
  const inviterName = inviterProfile?.name ?? 'Someone';

  // Avoid duplicate pending invitations
  const { data: existing } = await supabaseAdmin
    .from('invitations')
    .select('id')
    .eq('type', type)
    .eq('resource_id', resourceId)
    .eq('invited_user_id', invitedUserId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return res.status(200).json({ id: existing.id, alreadyExists: true });
  }

  // Insert invitation
  const { data: invitation, error: invErr } = await supabaseAdmin
    .from('invitations')
    .insert({
      type,
      resource_id: resourceId,
      resource_name: resourceName,
      invited_by_user_id: user.id,
      invited_by_name: inviterName,
      invited_user_id: invitedUserId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (invErr || !invitation) {
    return res.status(500).json({ error: invErr?.message ?? 'Failed to create invitation' });
  }

  // Insert notification for the invitee (service role bypasses RLS)
  const label = type === 'project' ? 'project' : 'channel';
  await supabaseAdmin.from('notifications').insert({
    id: crypto.randomUUID(),
    type: 'invitation',
    title: `Invited to ${resourceName}`,
    body: `${inviterName} invited you to join the ${label} "${resourceName}"`,
    user_id: invitedUserId,
    invitation_id: invitation.id,
    read: false,
    created_at: new Date().toISOString(),
  });

  return res.status(200).json({ id: invitation.id });
}
