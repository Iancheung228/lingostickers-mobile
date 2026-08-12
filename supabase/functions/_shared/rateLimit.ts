// ---------------------------------------------------------------------------
// Auth + per-user daily rate limiting for the paid AI endpoints.
//
// See supabase/migrations/027_api_rate_limit.sql for the storage/atomicity
// side. This module is the edge-function half: identify the caller from their
// JWT, then claim one unit of their daily quota before any upstream spend.
// ---------------------------------------------------------------------------
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Daily calls allowed per user, per endpoint, resetting at UTC midnight.
//
// create-sticker is the expensive one (background removal + vision) and is the
// number to tune. The translate-* endpoints get their own, larger bucket
// rather than sharing create-sticker's: they're the "fix the word the LLM
// guessed wrong" corrections on a draft, so sharing would mean two typo fixes
// silently cost a scan. They're still capped, just not at scan prices.
//
// Each can be overridden without a code change by setting the matching env var
// on the function (e.g. `npx supabase secrets set DAILY_LIMIT_CREATE_STICKER=25`).
const DEFAULT_DAILY_LIMITS: Record<string, number> = {
  'create-sticker': 10,
  'translate-word': 30,
  'translate-sentence': 30,
};

export type Endpoint = keyof typeof DEFAULT_DAILY_LIMITS;

/** An error carrying the HTTP status the caller should return. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// ---------------------------------------------------------------------------
// requireUserId — the caller's real, verified user id
// ---------------------------------------------------------------------------
// Platform-level JWT verification (which these functions deploy with) only
// proves the token is *a* valid project token — the anon key passes it too.
// It does not prove there's a real signed-in user behind the request, so the
// per-user quota has to key off a token we've actually resolved to a user.
//
// This is also why create-sticker no longer trusts the `userId` in its request
// body: that field is attacker-controlled, and a per-user limit keyed on it
// would be bypassed by sending a fresh random UUID with every request.
export async function requireUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new ApiError(401, 'Not signed in');

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new ApiError(401, 'Not signed in');
  return user.id;
}

// ---------------------------------------------------------------------------
// consumeQuota — claim one call against today's allowance, or throw 429
// ---------------------------------------------------------------------------
// Call this *before* doing any upstream work. A call counts once it's
// accepted, whether or not the result is any good — a rejected crop or a
// discarded scan has already cost the same Replicate/Groq spend as a kept one.
export async function consumeQuota(
  admin: SupabaseClient,
  userId: string,
  endpoint: Endpoint
): Promise<{ used: number; limit: number; remaining: number }> {
  const limit = dailyLimit(endpoint);

  const { data, error } = await admin
    .rpc('consume_api_quota', { p_user_id: userId, p_endpoint: endpoint, p_limit: limit });

  // A plpgsql RETURNS TABLE function comes back through PostgREST as an array
  // of rows; unwrap the single row we asked for.
  const row = (Array.isArray(data) ? data[0] : data) as
    { allowed: boolean; used: number; quota: number } | null | undefined;

  if (error || !row) {
    // Fail closed. If the counter can't be written we have no idea how much
    // this user has already spent today, and the whole point of this limit is
    // that the endpoints behind it cost money — an outage here must not turn
    // into an uncapped-spend window.
    console.error(`rate limit check failed for ${endpoint}:`, error?.message ?? 'no row returned');
    throw new ApiError(503, 'Service temporarily unavailable. Please try again in a moment.');
  }

  if (!row.allowed) {
    throw new ApiError(429, limitMessage(endpoint, limit));
  }

  return { used: row.used, limit, remaining: Math.max(0, limit - row.used) };
}

function dailyLimit(endpoint: Endpoint): number {
  const envKey = `DAILY_LIMIT_${endpoint.toUpperCase().replace(/-/g, '_')}`;
  const override = Number(Deno.env.get(envKey));
  return Number.isFinite(override) && override >= 0 ? override : DEFAULT_DAILY_LIMITS[endpoint];
}

function limitMessage(endpoint: Endpoint, limit: number): string {
  const noun = endpoint === 'create-sticker' ? 'sticker scans' : 'translations';
  return `Daily limit reached — you've used all ${limit} of today's ${noun}. Try again tomorrow.`;
}

// ---------------------------------------------------------------------------
// errorResponse — map a thrown error onto the right status
// ---------------------------------------------------------------------------
// ApiError keeps its own status (401/429/503) so the client can tell "you're
// rate limited" from "the server broke"; anything else is an unexpected
// failure and stays a 500, matching what these functions returned before.
export function errorResponse(err: unknown, corsHeaders: Record<string, string>): Response {
  const status = err instanceof ApiError ? err.status : 500;
  const message = (err as any)?.message ?? 'Internal server error';
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
