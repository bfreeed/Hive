import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, supabaseAdmin, requirePost } from './_lib/auth.js';

/**
 * POST /api/accept-invitation
 *
 * Called when the authenticated user accepts (or declines) an invitation.
 * Runs server-side with the service-role key so it can:
 *   - Add the user to a project's member_ids even before they are a member (bypasses RLS)
 *   - Add the user to the linked channel's member_ids in the same transaction
 *
 * Body: { invitationId: string, accept: boolean }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const auth = await getUserSettings(req, res);
  if (!auth) return;
  const { user } = auth;

  const { invitationId, accept } = req.body as { invitationId: string; accept: boolean };

  if (!invitationId || typeof accept !== 'boolean') {
    return res.status(400).json({ error: 'Missing invitationId or accept' });
  }

  // Load the invitation
  const { data: invitation, error: invErr } = await supabaseAdmin
    .from('invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('invited_user_id', user.id)   // verify it belongs to this user
    .eq('status', 'pending')
    .maybeSingle();

  if (invErr || !invitation) {
    return res.status(404).json({ error: 'Invitation not found or already handled' });
  }

  const status = accept ? 'accepted' : 'declined';

  // Update invitation status
  await supabaseAdmin.from('invitations').update({ status }).eq('id', invitationId);

  // Mark linked notification as read
  await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('invitation_id', invitationId);

  if (accept) {
    if (invitation.type === 'project') {
      // Add user to project member_ids (service role bypasses the members-only RLS)
      const { data: project } = await supabaseAdmin
        .from('projects')
        .select('id, member_ids')
        .eq('id', invitation.resource_id)
        .maybeSingle();

      if (project) {
        const newMemberIds = [...new Set([...(project.member_ids ?? []), user.id])];
        await supabaseAdmin
          .from('projects')
          .update({ member_ids: newMemberIds })
          .eq('id', invitation.resource_id);

        // Also add user to the linked project channel
        const { data: linkedChannels } = await supabaseAdmin
          .from('channels')
          .select('id, member_ids')
          .eq('project_id', invitation.resource_id);

        if (linkedChannels?.length) {
          for (const ch of linkedChannels) {
            if (!ch.member_ids.includes(user.id)) {
              const newChanMemberIds = [...ch.member_ids, user.id];
              await supabaseAdmin
                .from('channels')
                .update({ member_ids: newChanMemberIds })
                .eq('id', ch.id);
            }
          }
        }
      }
    } else {
      // Channel invitation — just add the user to member_ids
      const { data: channel } = await supabaseAdmin
        .from('channels')
        .select('id, member_ids')
        .eq('id', invitation.resource_id)
        .maybeSingle();

      if (channel) {
        const newMemberIds = [...new Set([...(channel.member_ids ?? []), user.id])];
        await supabaseAdmin
          .from('channels')
          .update({ member_ids: newMemberIds })
          .eq('id', invitation.resource_id);
      }
    }
  }

  return res.status(200).json({ ok: true, status });
}
