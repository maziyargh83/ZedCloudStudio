import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventBus } from '@z-cloud/core';
import { CHUNK_SIZE } from '@z-cloud/contracts';
import { UploadManager } from '@z-cloud/storage/uploads';
import { ServerRegistry } from '@z-cloud/storage/servers';
import { createApp, memoryRepository } from './app';

test('credentials can be corrected with an unfinished queue, while its destination is protected', async () => {
  const root = await mkdtemp(join(tmpdir(), 'zcloud-server-settings-'));
  const repository = memoryRepository();
  const registry = new ServerRegistry(root);
  const manager = new UploadManager(root, repository, registry);
  const app = createApp(repository, 'memory', new EventBus(), manager);
  try {
    const server = await registry.save(
      { name: 'Test', endpoint: 'https://example.invalid', bucket: 'test' },
      { accessKeyId: 'FAKE_OLD', secretAccessKey: 'FAKE_OLD_SECRET' },
    );
    await manager.create({
      id: randomUUID(),
      destinationId: server.id,
      metadata: {
        title: 'Waiting',
        filename: 'pending.png',
        type: 'photo',
        mime: 'image/png',
        size: 10,
        capturedAt: '2026-11-15T10:00:00.000Z',
      },
    });
    const headers = { 'Content-Type': 'application/json' };
    const rotated = await app.request(`/v1/servers/${server.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        server,
        credentials: { accessKeyId: 'FAKE_NEW', secretAccessKey: 'FAKE_NEW_SECRET' },
      }),
    });
    assert.equal(rotated.status, 200);
    assert.equal((await registry.credentials(server.id)).accessKeyId, 'FAKE_NEW');
    assert.equal(JSON.stringify(await rotated.json()).includes('FAKE_NEW_SECRET'), false);
    const redirected = await app.request(`/v1/servers/${server.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ server: { ...server, bucket: 'another-bucket' } }),
    });
    assert.equal(redirected.status, 409);
  } finally {
    await manager.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('HTTP upload queue saves real bytes and custom metadata; range previews and cancellation work', async () => {
  const root = await mkdtemp(join(tmpdir(), 'zcloud-http-upload-'));
  const repository = memoryRepository();
  const manager = new UploadManager(root, repository, new ServerRegistry(root));
  const app = createApp(repository, 'memory', new EventBus(), manager);
  const id = randomUUID();
  const bytes = Buffer.from('original-image-bytes');
  const headers = { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:4879' };
  try {
    const created = await app.request('/v1/uploads', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id,
        destinationId: 'local',
        metadata: {
          title: 'With my data',
          filename: 'test.png',
          type: 'photo',
          mime: 'image/png',
          size: bytes.length,
          capturedAt: '2026-11-15T10:00:00.000Z',
          customMetadata: { trip: 'Alps' },
        },
      }),
    });
    assert.equal(created.status, 201);
    const tooLarge = await app.request(`/v1/uploads/${id}/chunks/0`, {
      method: 'PUT',
      headers: { 'Content-Length': String(CHUNK_SIZE + 1) },
      body: 'x',
    });
    assert.equal(tooLarge.status, 413);
    assert.equal(
      (await app.request(`/v1/uploads/${id}/chunks/0`, { method: 'PUT', body: bytes })).status,
      200,
    );
    assert.equal(
      (await app.request(`/v1/uploads/${id}/complete`, { method: 'POST', headers, body: '{}' }))
        .status,
      202,
    );
    for (let i = 0; i < 100 && (await manager.get(id))?.status !== 'completed'; i++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal((await repository.find(id))?.customMetadata.trip, 'Alps');
    const original = await app.request(`/v1/media/${id}/content`);
    assert.equal(original.status, 200);
    assert.deepEqual(Buffer.from(await original.arrayBuffer()), bytes);
    const range = await app.request(`/v1/media/${id}/content`, { headers: { Range: 'bytes=2-5' } });
    assert.equal(range.status, 206);
    assert.equal(await range.text(), bytes.subarray(2, 6).toString());
    assert.equal(
      (await app.request(`/v1/media/${id}/content`, { headers: { Range: 'bytes=999-1000' } }))
        .status,
      416,
    );
    const list = await (await app.request('/v1/uploads')).json();
    assert.equal(list.data[0].status, 'completed');
    assert.equal('remote' in list.data[0], false);
    const second = randomUUID();
    await manager.create({
      id: second,
      destinationId: 'local',
      metadata: { ...list.data[0].metadata },
    });
    await manager.control(second, 'cancel');
    await assert.rejects(() => manager.chunk(second, 0, bytes), /Resume/);
  } finally {
    await manager.close();
    await rm(root, { recursive: true, force: true });
  }
});
