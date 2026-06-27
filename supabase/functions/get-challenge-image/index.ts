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

// The challenge snapshot image lives in the sender's storage folder, which
// only the sender can read directly (storage RLS is per-owner-folder). The
// receiver needs to view it while attempting/reviewing the challenge, so
// this signs it with the service role on their behalf, after verifying
// they're actually a party to the challenge.
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

    const { challenge_id } = await req.json();
    if (!challenge_id) return json({ error: 'Missing challenge_id' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: challenge } = await admin
      .from('sticker_challenges')
      .select('sender_id, receiver_id, snapshot_image_path')
      .eq('id', challenge_id)
      .single();

    if (!challenge || (challenge.sender_id !== user.id && challenge.receiver_id !== user.id)) {
      return json({ error: 'Challenge not found' }, 404);
    }

    const { data: signed, error: signErr } = await admin.storage
      .from('sticker-images')
      .createSignedUrl(challenge.snapshot_image_path, 3600);

    if (signErr || !signed) return json({ error: 'Could not load image' }, 500);

    return json({ url: signed.signedUrl }, 200);

  } catch (err: any) {
    console.error('get-challenge-image error:', err);
    return json({ error: err?.message ?? 'Internal server error' }, 500);
  }
});
