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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Every user-owned table cascades from profiles.id -> auth.users.id
    // (ON DELETE CASCADE), but storage objects aren't part of that cascade
    // and have to be cleaned up by hand. list() returns at most 1000 at a
    // time, and since we remove each page before listing again, the next
    // list() call naturally returns whatever's left — no cursor needed.
    let page = await admin.storage.from('sticker-images').list(user.id, { limit: 1000 });
    while (page.data && page.data.length > 0) {
      const paths = page.data.map(f => `${user.id}/${f.name}`);
      await admin.storage.from('sticker-images').remove(paths);
      if (page.data.length < 1000) break;
      page = await admin.storage.from('sticker-images').list(user.id, { limit: 1000 });
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) return json({ error: deleteError.message }, 500);

    return json({ success: true }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
