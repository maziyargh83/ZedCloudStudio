import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LiaraGateway, AIProviderError } from '@z-cloud/ai';
import { createApp, memoryRepository } from './app';

const options = {
  apiKey: 'test-private-key',
  baseURL: 'https://ai.liara.ir/api/v1/000000000000000000000000',
};
const headers = { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:4878' };
test('Liara receives only explicit text and uses a bounded authenticated request', async () => {
  let calls = 0;
  const gateway = new LiaraGateway({
    ...options,
    fetch: async (url, init) => {
      calls++;
      assert.equal(url, options.baseURL + '/chat/completions');
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        'Bearer test-private-key',
      );
      const payload = JSON.parse(init?.body as string);
      assert.equal(payload.max_tokens, 1024);
      assert.equal(payload.stream, false);
      assert.equal(payload.messages.length, 2);
      assert.equal(payload.messages[1].content, 'Write a caption.');
      return Response.json({ choices: [{ message: { content: 'Test response' } }] });
    },
  });
  const repository = memoryRepository();
  await repository.create({
    title: 'Private catalog title',
    filename: 'private.jpg',
    type: 'photo',
    mime: 'image/jpeg',
    size: 1,
    source: 'local',
    capturedAt: new Date().toISOString(),
  });
  const app = createApp(repository, 'memory', undefined, undefined, undefined, {
    gateway,
    model: gateway.model,
  });
  const status = await (await app.request('/v1/ai/status')).json();
  assert.equal(status.configured, true);
  assert.equal(JSON.stringify(status).includes(options.apiKey), false);
  const reply = await app.request('/v1/ai/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt: 'Write a caption.' }),
  });
  assert.equal(reply.status, 200);
  assert.equal((await reply.json()).text, 'Test response');
  assert.equal(calls, 1);
  for (const body of [
    '{',
    '{}',
    JSON.stringify({ prompt: ' ', apiKey: 'injected' }),
    JSON.stringify({ prompt: 'x'.repeat(8001) }),
  ]) {
    assert.equal(
      (await app.request('/v1/ai/generate', { method: 'POST', headers, body })).status,
      400,
    );
  }
  assert.equal(
    (
      await app.request('/v1/ai/generate', {
        method: 'POST',
        headers: { ...headers, Origin: 'https://foreign.example' },
        body: '{"prompt":"hi"}',
      })
    ).status,
    403,
  );
  assert.equal(calls, 1);
});

test('unconfigured and provider failures are honest and never echo upstream secrets', async () => {
  const empty = createApp(memoryRepository(), 'memory');
  assert.equal((await (await empty.request('/v1/ai/status')).json()).configured, false);
  assert.equal(
    (await empty.request('/v1/ai/generate', { method: 'POST', headers, body: '{"prompt":"hi"}' }))
      .status,
    503,
  );
  const gateway = new LiaraGateway({
    ...options,
    fetch: async () => Response.json({ error: options.apiKey }, { status: 401 }),
  });
  const app = createApp(memoryRepository(), 'memory', undefined, undefined, undefined, {
    gateway,
    model: gateway.model,
  });
  const response = await app.request('/v1/ai/generate', {
    method: 'POST',
    headers,
    body: '{"prompt":"hi"}',
  });
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes(options.apiKey), false);
  const invalid = new LiaraGateway({
    ...options,
    fetch: async () => Response.json({ choices: [] }),
  });
  await assert.rejects(async () => {
    for await (const _ of invalid.generate({ prompt: 'hi', sources: [] })) {
    }
  }, AIProviderError);
  assert.throws(
    () =>
      new LiaraGateway({
        ...options,
        baseURL: 'https://foreign.example/api/v1/000000000000000000000000',
      }),
    AIProviderError,
  );
});

test('concurrent paid requests are limited and cancellation releases the slot', async () => {
  let started!: () => void;
  const ready = new Promise<void>((resolve) => (started = resolve));
  let calls = 0;
  const app = createApp(memoryRepository(), 'memory', undefined, undefined, undefined, {
    model: 'test',
    gateway: {
      async *generate(request) {
        if (++calls === 1) {
          started();
          await new Promise<void>((resolve) =>
            request.signal!.addEventListener('abort', () => resolve(), { once: true }),
          );
          request.signal!.throwIfAborted();
        }
        yield 'ready';
      },
    },
  });
  const controller = new AbortController();
  const first = app.request('/v1/ai/generate', {
    method: 'POST',
    headers,
    body: '{"prompt":"hi"}',
    signal: controller.signal,
  });
  await ready;
  assert.equal(
    (await app.request('/v1/ai/generate', { method: 'POST', headers, body: '{"prompt":"hi"}' }))
      .status,
    429,
  );
  controller.abort();
  assert.equal((await first).status, 499);
  assert.equal(
    (await app.request('/v1/ai/generate', { method: 'POST', headers, body: '{"prompt":"hi"}' }))
      .status,
    200,
  );
});
