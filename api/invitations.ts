import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSettings, supabaseAdmin, requirePost } from './_lib/auth.js';

/**
 * POST /api/invitations
 *
 * Unified endpoint for invitation send/accept/decline actions.
 * Body: { action: 'send' | 'respond', ...fields }
 *
 * 'send' body:    { action, type, resourceId, resourceName, invitedUserId }
 * 'respond' body: { action, invitationId, accept }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const auth = await getUserSettings(req, res);
  if (!auth) return;
  const { user } = auth;

  const { action } = req.body as { action?: 'send' | 'respond' };

  if (action === 'send') {
    const { type, resourceId, resourceName, invitedUserId } = req.body as {
      type: 'project' | 'channel';
      resourceId: string;
      resourceName: string;
      invitedUserId: string;
    };

    if (!type || !resourceId || !resourceName || !invitedUserId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: inviterProfile } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();
    const inviterName = inviterProfile?.name ?? 'Someone';

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

  if (action === 'respond') {
    const { invitationId, accept } = req.body as { invitationId: string; accept: boolean };

    if (!invitationId || typeof accept !== 'boolean') {
      return res.status(400).json({ error: 'Missing invitationId or accept' });
    }

    const { data: invitation, error: invErr } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('invited_user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (invErr || !invitation) {
      return res.status(404).json({ error: 'Invitation not found or already handled' });
    }

    const status = accept ? 'accepted' : 'declined';

    await supabaseAdmin.from('invitations').update({ status }).eq('id', invitationId);

    await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('invitation_id', invitationId);

    if (accept) {
      if (invitation.type === 'project') {
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

  return res.status(400).json({ error: 'Invalid or missing action' });
}
