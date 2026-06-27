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

// Normalize for comparison: lowercase, strip diacritics, trim whitespace.
// Lets "cafe" match "café".
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
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
    const receiverId = user.id;

    const { challenge_id, answer, use_hint } = await req.json();
    if (!challenge_id) return json({ error: 'Missing challenge_id' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── 1. Fetch challenge, verify receiver ──────────────────────
    const { data: challenge, error: fetchErr } = await admin
      .from('sticker_challenges')
      .select('*')
      .eq('id', challenge_id)
      .eq('receiver_id', receiverId)
      .single();

    if (fetchErr || !challenge) return json({ error: 'Challenge not found' }, 404);

    // ── 2. Already completed ─────────────────────────────────────
    if (challenge.status === 'won') {
      return json({ outcome: 'already_completed' }, 200);
    }

    // Mark active on first open
    if (challenge.status === 'pending') {
      await admin.from('sticker_challenges').update({ status: 'active' }).eq('id', challenge_id);
    }

    // ── 3. Hint request ────────────────────────────────────────────
    if (use_hint === true) {
      if (!challenge.hint_used) {
        await admin.from('sticker_challenges').update({ hint_used: true }).eq('id', challenge_id);
      }
      return json({
        outcome: 'hint',
        first_letter: challenge.snapshot_word.charAt(0),
        attempts_used: challenge.attempts_used,
      }, 200);
    }

    // ── 4. Answer evaluation ─────────────────────────────────────
    if (!answer || typeof answer !== 'string') return json({ error: 'Missing answer' }, 400);

    // Accepts the canonical word or any synonym generated at send time.
    const acceptedAnswers = challenge.snapshot_accepted_answers?.length
      ? challenge.snapshot_accepted_answers
      : [challenge.snapshot_word];
    const normalizedAnswer = normalize(answer);
    const correct = acceptedAnswers.some((a: string) => normalize(a) === normalizedAnswer);

    if (correct) {
      // Award sticker to receiver. snapshot_image_path lives in the
      // sender's storage folder (only they can read it) — copy it into the
      // receiver's own folder so the awarded sticker is actually viewable
      // like any other sticker in their collection.
      const ext = challenge.snapshot_image_path.split('.').pop() || 'jpg';
      const wonImagePath = `${receiverId}/${crypto.randomUUID()}-challenge.${ext}`;
      const { error: copyErr } = await admin.storage
        .from('sticker-images')
        .copy(challenge.snapshot_image_path, wonImagePath);
      if (copyErr) console.error('submit-challenge-answer: image copy failed:', copyErr);

      // Same treatment for the memory photo, if the sender had one, so the
      // awarded sticker gets the same flip-to-reveal-the-moment experience
      // as a sticker the receiver scanned themselves.
      let wonMemoryPath: string | null = null;
      if (challenge.snapshot_memory_photo_path) {
        const memoryExt = challenge.snapshot_memory_photo_path.split('.').pop() || 'jpg';
        const candidate = `${receiverId}/${crypto.randomUUID()}-challenge-memory.${memoryExt}`;
        const { error: memoryCopyErr } = await admin.storage
          .from('sticker-images')
          .copy(challenge.snapshot_memory_photo_path, candidate);
        if (memoryCopyErr) console.error('submit-challenge-answer: memory photo copy failed:', memoryCopyErr);
        else wonMemoryPath = candidate;
      }

      const { data: newSticker, error: stickerErr } = await admin
        .from('stickers')
        .insert({
          user_id: receiverId,
          word: challenge.snapshot_word,
          translation: challenge.snapshot_translation,
          reading: challenge.snapshot_reading,
          sentence: challenge.snapshot_sentence,
          sentence_translation: '',
          category: 'Other',
          image_path: copyErr ? challenge.snapshot_image_path : wonImagePath,
          memory_photo_path: wonMemoryPath,
          language: challenge.snapshot_language,
          source: 'challenge',
          discovered_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (stickerErr) throw stickerErr;

      await admin
        .from('sticker_challenges')
        .update({ status: 'won', won_sticker_id: newSticker.id, completed_at: new Date().toISOString() })
        .eq('id', challenge_id);

      return json({ outcome: 'correct', won_sticker_id: newSticker.id }, 200);
    }

    // ── Wrong answer — unlimited retries, just count attempts ─────
    const newAttempts = challenge.attempts_used + 1;
    await admin.from('sticker_challenges').update({ attempts_used: newAttempts }).eq('id', challenge_id);

    return json({
      outcome: 'wrong',
      attempts_used: newAttempts,
      hint_available: !challenge.hint_used,
    }, 200);

  } catch (err: any) {
    console.error('submit-challenge-answer error:', err);
    return json({ error: err?.message ?? 'Internal server error' }, 500);
  }
});
