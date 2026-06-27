import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAcceptedAnswersWithGroq } from '../_shared/vocab.ts';

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

    // Verify the caller's identity with a user-scoped client
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Not authenticated' }, 401);
    const senderId = user.id;

    const { sticker_id, receiver_id } = await req.json();
    if (!sticker_id || !receiver_id) return json({ error: 'Missing sticker_id or receiver_id' }, 400);
    if (senderId === receiver_id) return json({ error: 'Cannot challenge yourself' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── 1. Verify accepted friendship ────────────────────────────
    const { data: friendship } = await admin
      .from('friendships')
      .select('id, status')
      .or(`and(requester_id.eq.${senderId},addressee_id.eq.${receiver_id}),and(requester_id.eq.${receiver_id},addressee_id.eq.${senderId})`)
      .eq('status', 'accepted')
      .single();

    if (!friendship) return json({ error: 'You must be friends to send a challenge' }, 403);

    // ── 2. Verify sticker ownership ──────────────────────────────
    const { data: sticker } = await admin
      .from('stickers')
      .select('id, word, translation, reading, sentence, image_path, memory_photo_path, language')
      .eq('id', sticker_id)
      .eq('user_id', senderId)
      .single();

    if (!sticker) return json({ error: 'You do not own this sticker' }, 403);

    // ── 2b. Snapshot the image (and memory photo, if any) into their own
    // copies ────────────────────────────────────────────────────────────
    // These paths are only readable by the sender (storage RLS is
    // per-owner-folder), and may be deleted later if the sender deletes the
    // original sticker. Copy them now so the challenge has its own images
    // that outlive the original and that submit-challenge-answer can
    // re-copy into the receiver's folder on a win — giving the receiver the
    // same flip-to-reveal-the-moment experience as a sticker they scanned
    // themselves.
    const ext = sticker.image_path.split('.').pop() || 'jpg';
    const snapshotImagePath = `${senderId}/${crypto.randomUUID()}-challenge-snapshot.${ext}`;
    const { error: copyErr } = await admin.storage
      .from('sticker-images')
      .copy(sticker.image_path, snapshotImagePath);
    if (copyErr) console.error('send-challenge: image snapshot copy failed:', copyErr);
    const challengeImagePath = copyErr ? sticker.image_path : snapshotImagePath;

    let challengeMemoryPath: string | null = null;
    if (sticker.memory_photo_path) {
      const memoryExt = sticker.memory_photo_path.split('.').pop() || 'jpg';
      const snapshotMemoryPath = `${senderId}/${crypto.randomUUID()}-challenge-snapshot-memory.${memoryExt}`;
      const { error: memoryCopyErr } = await admin.storage
        .from('sticker-images')
        .copy(sticker.memory_photo_path, snapshotMemoryPath);
      if (memoryCopyErr) console.error('send-challenge: memory photo snapshot copy failed:', memoryCopyErr);
      else challengeMemoryPath = snapshotMemoryPath;
    }

    // ── 3. Prevent duplicate pending/active challenge ─────────────
    const { data: existing } = await admin
      .from('sticker_challenges')
      .select('id')
      .eq('sender_id', senderId)
      .eq('receiver_id', receiver_id)
      .eq('source_sticker_id', sticker_id)
      .in('status', ['pending', 'active'])
      .single();

    if (existing) return json({ error: 'A pending challenge with this sticker already exists' }, 409);

    // ── 3b. Other acceptable ways to write/say the word ───────────
    // Generated once here (not on every guess) so answer-checking stays an
    // instant, free string comparison. snapshot_word is always included as
    // a fallback even if this call fails or returns nothing.
    const synonyms = await getAcceptedAnswersWithGroq(sticker.word, sticker.language);
    const acceptedAnswers = [sticker.word, ...synonyms];

    // ── 4. Insert challenge ──────────────────────────────────────
    const { data: challenge, error: insertErr } = await admin
      .from('sticker_challenges')
      .insert({
        sender_id: senderId,
        receiver_id,
        source_sticker_id: sticker_id,
        snapshot_word: sticker.word,
        snapshot_translation: sticker.translation,
        snapshot_reading: sticker.reading,
        snapshot_sentence: sticker.sentence,
        snapshot_image_path: challengeImagePath,
        snapshot_memory_photo_path: challengeMemoryPath,
        snapshot_language: sticker.language,
        snapshot_accepted_answers: acceptedAnswers,
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;

    // ── 5. Push notification (fire-and-forget) ───────────────────
    const { data: tokens } = await admin
      .from('push_tokens')
      .select('token')
      .eq('user_id', receiver_id);

    if (tokens && tokens.length > 0) {
      const { data: senderProfile } = await admin
        .from('profiles')
        .select('username')
        .eq('id', senderId)
        .single();

      const senderName = senderProfile?.username ?? 'Someone';
      const messages = tokens.map((t: { token: string }) => ({
        to: t.token,
        title: 'New Challenge! 🎯',
        body: `${senderName} challenged you with "${sticker.translation}"`,
        data: { type: 'challenge', challenge_id: challenge.id },
        sound: 'default',
      }));

      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      }).catch(() => {});
    }

    return json({ challenge_id: challenge.id }, 200);

  } catch (err: any) {
    console.error('send-challenge error:', err);
    return json({ error: err?.message ?? 'Internal server error' }, 500);
  }
});
