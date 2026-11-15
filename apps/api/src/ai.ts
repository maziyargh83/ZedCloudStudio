import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { aiGenerateSchema } from '@z-cloud/contracts';
import { AIProviderError, type AIGateway, type ToolChatGateway } from '@z-cloud/ai';

export interface AIService {
  gateway: AIGateway & Partial<ToolChatGateway>;
  model: string;
}

export function aiRoutes(service?: AIService) {
  const routes = new Hono();
  let busy = false;
  routes.get('/status', (c) =>
    c.json({
      provider: 'liara',
      configured: Boolean(service),
      model: service?.model ?? null,
    }),
  );
  routes.post('/generate', bodyLimit({ maxSize: 32 * 1024 }), async (c) => {
    if (!service) return c.json({ error: 'Liara is not configured on this server.' }, 503);
    const input = aiGenerateSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return c.json({ error: 'Enter a prompt of 1–8000 characters.' }, 400);
    if (busy)
      return c.json({ error: 'An AI request is already running. Wait for it to finish.' }, 429);
    busy = true;
    const abort = new AbortController();
    const onAbort = () => abort.abort();
    c.req.raw.signal.addEventListener('abort', onAbort, { once: true });
    if (c.req.raw.signal.aborted) abort.abort();
    try {
      let text = '';
      for await (const chunk of service.gateway.generate({
        prompt: input.data.prompt,
        sources: [],
        signal: abort.signal,
      }))
        text += chunk;
      return c.json({ text, provider: 'liara', model: service.model });
    } catch (error) {
      if (abort.signal.aborted) return c.json({ error: 'Generation cancelled.' }, 499 as 400);
      if (error instanceof AIProviderError)
        return c.json({ error: error.message }, error.status as 400);
      return c.json({ error: 'AI generation failed. Try again later.' }, 502);
    } finally {
      busy = false;
      c.req.raw.signal.removeEventListener('abort', onAbort);
    }
  });
  return routes;
}
