import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DELETE_FAILED = "We couldn't finish deleting your account just now. It's still active — please try again.";

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
    // Captured so the narrowing above survives into emptyUserFolder's closure.
    const userId = user.id;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Every user-owned table cascades from profiles.id -> auth.users.id
    // (ON DELETE CASCADE), but storage objects aren't part of that cascade
    // and have to be cleaned up by hand. list() returns at most 1000 at a
    // time, and since we remove each page before listing again, the next
    // list() call naturally returns whatever's left — no cursor needed.
    //
    // Both list() and remove() report failure through `error`, not by
    // throwing, so each is checked: deleting the account after a failed
    // removal would orphan files we can no longer attribute to anyone. A
    // throw here lands in the catch below, the account is left intact, and
    // the user can simply try again.
    async function emptyUserFolder(bucket: string) {
      let page = await admin.storage.from(bucket).list(userId, { limit: 1000 });
      if (page.error) throw new Error(`list ${bucket}: ${page.error.message}`);
      while (page.data && page.data.length > 0) {
        const paths = page.data.map(f => `${userId}/${f.name}`);
        const { error: removeError } = await admin.storage.from(bucket).remove(paths);
        if (removeError) throw new Error(`remove ${bucket}: ${removeError.message}`);
        if (page.data.length < 1000) break;
        page = await admin.storage.from(bucket).list(userId, { limit: 1000 });
        if (page.error) throw new Error(`list ${bucket}: ${page.error.message}`);
      }
    }

    await emptyUserFolder('sticker-images');
    // Avatars live in their own bucket, and that one is public — an orphaned
    // file here would stay fetchable by anyone holding the URL long after the
    // account was gone, so it matters more than the private one, not less.
    await emptyUserFolder('avatars');

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('delete-account: deleteUser failed:', deleteError);
      return json({ error: DELETE_FAILED }, 500);
    }

    return json({ success: true }, 200);
  } catch (err) {
    // The real cause goes to the function log; the client gets copy it can
    // show as-is (getFunctionErrorMessage displays any string body verbatim).
    console.error('delete-account error:', err);
    return json({ error: DELETE_FAILED }, 500);
  }
});
