import { FunctionsHttpError } from '@supabase/supabase-js';

// supabase.functions.invoke() collapses any non-2xx response into a generic
// FunctionsHttpError ("Edge Function returned a non-2xx status code"),
// discarding the JSON body our edge functions return (`{ error: '...' }`).
// This pulls that real message back out so callers can show it to the user.
export async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (typeof body?.error === 'string') return body.error;
    } catch {
      // fall through to generic message below
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
