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

    // Accepts one id or many. The Friends tab needs a thumbnail per row, and
    // asking for them one at a time meant an invocation per row on every
    // refresh; the authorisation check below is per-id either way, so batching
    // costs nothing in rigour and saves a dozen round trips.
    const body = await req.json();
    const singleId: string | undefined = body?.challenge_id;
    const manyIds: unknown = body?.challenge_ids;

    const ids: string[] = Array.isArray(manyIds)
      ? manyIds.filter((id): id is string => typeof id === 'string')
      : singleId
        ? [singleId]
        : [];

    if (ids.length === 0) return json({ error: 'Missing challenge_id' }, 400);
    // Bounded so one request can't be turned into an unbounded signing job.
    if (ids.length > 30) return json({ error: 'Too many ids' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: challenges } = await admin
      .from('sticker_challenges')
      .select('id, sender_id, receiver_id, snapshot_image_path')
      .in('id', ids);

    // Every id is still checked individually against the caller — being a
    // party to one challenge grants nothing about the others in the batch.
    const authorised = (challenges ?? []).filter(
      c => c.sender_id === user.id || c.receiver_id === user.id
    );

    const urls: Record<string, string> = {};
    for (const challenge of authorised) {
      if (!challenge.snapshot_image_path) continue;
      const { data: signed } = await admin.storage
        .from('sticker-images')
        .createSignedUrl(challenge.snapshot_image_path, 3600);
      if (signed) urls[challenge.id] = signed.signedUrl;
    }

    // Single-id callers keep the original response shape.
    if (singleId && !Array.isArray(manyIds)) {
      const url = urls[singleId];
      if (!url) return json({ error: 'Challenge not found' }, 404);
      return json({ url }, 200);
    }

    return json({ urls }, 200);

  } catch (err: any) {
    console.error('get-challenge-image error:', err);
    return json({ error: err?.message ?? 'Internal server error' }, 500);
  }
});
