import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Not authenticated' }, 401);
    const addresseeId = user.id;

    const { friendship_id, status } = await req.json();
    if (!friendship_id || (status !== 'accepted' && status !== 'declined')) {
      return json({ error: 'Missing friendship_id or invalid status' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── 1. Verify this is a pending request addressed to the caller ─
    const { data: friendship } = await admin
      .from('friendships')
      .select('id, requester_id, addressee_id, status')
      .eq('id', friendship_id)
      .single();

    if (!friendship || friendship.addressee_id !== addresseeId || friendship.status !== 'pending') {
      return json({ error: 'No pending request found' }, 404);
    }

    if (status === 'declined') {
      // Delete rather than mark declined, so the requester can send again later.
      const { error: deleteErr } = await admin
        .from('friendships')
        .delete()
        .eq('id', friendship_id);
      if (deleteErr) throw deleteErr;
      return json({ ok: true }, 200);
    }

    // ── 2. Accept ───────────────────────────────────────────────────
    const { error: updateErr } = await admin
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendship_id);
    if (updateErr) throw updateErr;

    // ── 3. Push notification to the original requester (fire-and-forget) ─
    const { data: tokens } = await admin
      .from('push_tokens')
      .select('token')
      .eq('user_id', friendship.requester_id);

    if (tokens && tokens.length > 0) {
      const { data: addresseeProfile } = await admin
        .from('profiles')
        .select('username')
        .eq('id', addresseeId)
        .single();

      const addresseeName = addresseeProfile?.username ?? 'Someone';
      const messages = tokens.map((t: { token: string }) => ({
        to: t.token,
        title: 'Friend Request Accepted 🎉',
        body: `${addresseeName} accepted your friend request`,
        data: { type: 'friend_accepted', friendship_id },
        sound: 'default',
      }));

      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      }).catch(() => {});
    }

    return json({ ok: true }, 200);

  } catch (err: any) {
    console.error('respond-friend-request error:', err);
    return json({ error: err?.message ?? 'Internal server error' }, 500);
  }
});
