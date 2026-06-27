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
    const requesterId = user.id;

    const { addressee_id } = await req.json();
    if (!addressee_id) return json({ error: 'Missing addressee_id' }, 400);
    if (requesterId === addressee_id) return json({ error: 'Cannot friend yourself' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── 1. Verify the target user exists ─────────────────────────
    const { data: addressee } = await admin
      .from('profiles')
      .select('id, username')
      .eq('id', addressee_id)
      .single();

    if (!addressee) return json({ error: 'User not found' }, 404);

    // ── 2. Prevent duplicate pair (either direction) ──────────────
    const { data: existing } = await admin
      .from('friendships')
      .select('id')
      .or(`and(requester_id.eq.${requesterId},addressee_id.eq.${addressee_id}),and(requester_id.eq.${addressee_id},addressee_id.eq.${requesterId})`)
      .single();

    if (existing) return json({ error: 'A friend request or friendship already exists' }, 409);

    // ── 3. Insert friendship ───────────────────────────────────────
    const { data: friendship, error: insertErr } = await admin
      .from('friendships')
      .insert({ requester_id: requesterId, addressee_id })
      .select('id')
      .single();

    if (insertErr) throw insertErr;

    // ── 4. Push notification (fire-and-forget) ────────────────────
    const { data: tokens } = await admin
      .from('push_tokens')
      .select('token')
      .eq('user_id', addressee_id);

    if (tokens && tokens.length > 0) {
      const { data: requesterProfile } = await admin
        .from('profiles')
        .select('username')
        .eq('id', requesterId)
        .single();

      const requesterName = requesterProfile?.username ?? 'Someone';
      const messages = tokens.map((t: { token: string }) => ({
        to: t.token,
        title: 'New Friend Request 👋',
        body: `${requesterName} wants to be your friend`,
        data: { type: 'friend_request', friendship_id: friendship.id },
        sound: 'default',
      }));

      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      }).catch(() => {});
    }

    return json({ friendship_id: friendship.id }, 200);

  } catch (err: any) {
    console.error('send-friend-request error:', err);
    return json({ error: err?.message ?? 'Internal server error' }, 500);
  }
});
