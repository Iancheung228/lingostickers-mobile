// ---------------------------------------------------------------------------
// A fake LlmProvider that records the request instead of sending it.
//
// Used by show-prompt, prompt-lab's baseline mode and the prompt tests. It
// exists so those tools inspect the *neutral* request — the parts and the
// schema `vocab.ts` assembled — rather than one provider's wire bytes. Before
// the provider layer they stubbed `globalThis.fetch` and reached into
// `body.messages[0].content`, which meant a provider swap silently broke every
// one of them.
// ---------------------------------------------------------------------------
import type {
  LlmProvider,
  LlmRequest,
  LlmResult,
} from '../supabase/functions/_shared/llm/index.ts';

export interface Capture {
  provider: LlmProvider;
  /** The last request handed to the provider. */
  request(): LlmRequest;
  /** Just the text parts, joined — i.e. the prompt a human would read. */
  prompt(): string;
  /** How many images the request carried. */
  imageCount(): number;
}

/**
 * @param reply what the fake model should answer with (raw JSON text).
 */
export function capturingProvider(reply = '{"sentence":""}'): Capture {
  let last: LlmRequest | null = null;
  const provider: LlmProvider = {
    name: 'capture',
    model: 'capture',
    isConfigured: () => true,
    async send(request: LlmRequest): Promise<LlmResult> {
      last = request;
      return {
        text: reply,
        usage: { promptTokens: 0, outputTokens: 0 },
        provider: 'capture',
        model: 'capture',
      };
    },
  };
  const require = () => {
    if (!last) throw new Error('capturingProvider: nothing was sent');
    return last;
  };
  return {
    provider,
    request: require,
    prompt: () =>
      require()
        .parts.filter((p): p is { kind: 'text'; text: string } => p.kind === 'text')
        .map((p) => p.text)
        .join('\n'),
    imageCount: () => require().parts.filter((p) => p.kind === 'image').length,
  };
}
