import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryRepository } from './app';
import { EventBus } from '@z-cloud/core';
const input = {
  title: 'A real import',
  filename: 'lake.jpg',
  type: 'photo',
  mime: 'image/jpeg',
  size: 2048,
  source: 'local',
  capturedAt: '2026-11-15T10:00:00.000Z',
};
test('media API validates, creates, emits events, updates and retrieves an asset', async () => {
  const events = new EventBus();
  const imported: string[] = [];
  events.on('media.imported', (e) => imported.push(e.asset.id));
  const app = createApp(memoryRepository(), 'memory', events);
  const bad = await app.request('/v1/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, size: -1 }),
  });
  assert.equal(bad.status, 400);
  const created = await app.request('/v1/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, tags: ['alpine'], description: 'Keep this description' }),
  });
  assert.equal(created.status, 201);
  const { data: asset } = await created.json();
  assert.deepEqual(imported, [asset.id]);
  assert.deepEqual(asset.tags, ['alpine']);
  const changed = await app.request(`/v1/media/${asset.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favorite: true, title: 'New title' }),
  });
  assert.equal(changed.status, 200);
  assert.equal((await changed.json()).data.favorite, true);
  const retrieved = await app.request(`/v1/media/${asset.id}`);
  assert.equal((await retrieved.json()).data.title, 'New title');
  const preserved = await (await app.request(`/v1/media/${asset.id}`)).json();
  assert.deepEqual(preserved.data.tags, ['alpine']);
  assert.equal(preserved.data.description, 'Keep this description');
  const list = await app.request('/v1/media');
  assert.equal((await list.json()).data.length, 1);
  const unknown = await app.request('/v1/media/00000000-0000-4000-8000-000000000000');
  assert.equal(unknown.status, 404);
});
test('invalid JSON and empty patches are rejected; memory mode is disclosed', async () => {
  const app = createApp(memoryRepository(), 'memory');
  assert.equal(
    (
      await app.request('/v1/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await app.request('/v1/media/00000000-0000-4000-8000-000000000000', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).status,
    400,
  );
  const health = await app.request('/health');
  assert.equal((await health.json()).persistent, false);
});
