import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createLocalRepository } from '@z-cloud/db/local';
import { CHUNK_SIZE, uploadMetadataSchema } from '@z-cloud/contracts';
import { UploadManager } from './uploads';
import { ServerRegistry } from './servers';

async function waitFor(manager: UploadManager, id: string, state: string) {
  for (let i = 0; i < 250; i++) {
    const job = await manager.get(id);
    if (job?.status === state) return job;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error(`Expected ${state}, got ${(await manager.get(id))?.status}`);
}
const metadata = (size: number) =>
  uploadMetadataSchema.parse({
    title: 'A careful import',
    filename: 'original.png',
    mime: 'image/png',
    type: 'photo',
    size,
    capturedAt: '2026-11-15T10:00:00.000Z',
    tags: ['keep'],
    description: 'My description',
    location: 'Shiraz',
    customMetadata: { client: 'Personal' },
  });
test('chunk resume, duplicate validation, final bytes, metadata and idempotent catalog registration', async () => {
  const root = await mkdtemp(join(tmpdir(), 'zcloud-upload-'));
  const repository = createLocalRepository(join(root, 'catalog.json'));
  const servers = new ServerRegistry(root);
  const first = new UploadManager(root, repository, servers);
  const id = randomUUID();
  let second: UploadManager | undefined;
  try {
    const bytes = Buffer.alloc(CHUNK_SIZE + 31, 7);
    await first.create({ id, destinationId: 'local', metadata: metadata(bytes.length) });
    await first.chunk(id, 0, bytes.subarray(0, CHUNK_SIZE));
    await first.chunk(id, 0, bytes.subarray(0, CHUNK_SIZE));
    await assert.rejects(() => first.chunk(id, 0, Buffer.alloc(CHUNK_SIZE, 3)), /differs/);
    await assert.rejects(() => first.complete(id), /not arrived/);
    await first.control(id, 'pause');
    await assert.rejects(() => first.chunk(id, 1, bytes.subarray(CHUNK_SIZE)), /Resume/);
    await first.close();
    second = new UploadManager(root, createLocalRepository(join(root, 'catalog.json')), servers);
    await second.recover();
    assert.equal((await second.get(id))?.status, 'paused');
    await second.control(id, 'resume');
    await second.chunk(id, 1, bytes.subarray(CHUNK_SIZE));
    await second.complete(id);
    await waitFor(second, id, 'completed');
    assert.deepEqual(await readFile(second.original(id)), bytes);
    const asset = await repository.find(id);
    assert.equal(asset?.source, 'upload');
    assert.equal(asset?.location, 'Shiraz');
    assert.deepEqual(asset?.customMetadata, { client: 'Personal' });
    assert.deepEqual(asset?.tags, ['keep']);
    await second.complete(id);
    assert.equal((await repository.list()).length, 1);
    assert.equal(
      (await second.get(id))?.contentHash,
      createHash('sha256').update(bytes).digest('hex'),
    );
  } finally {
    await first.close();
    await second?.close();
    await rm(root, { recursive: true, force: true });
  }
});
test('S3 checkpoints resume after metadata failure without uploading the original twice; secrets stay encrypted', async () => {
  let failMetadata = true,
    partCalls = 0,
    completeCalls = 0;
  const endpoint = createServer(async (request, response) => {
    const url = new URL(request.url!, 'http://localhost');
    for await (const _chunk of request) {
      /* Drain the test request. */
    }
    response.setHeader('Content-Type', 'application/xml');
    if (request.method === 'POST' && url.searchParams.has('uploads')) {
      response.end(
        '<InitiateMultipartUploadResult><UploadId>test-upload</UploadId></InitiateMultipartUploadResult>',
      );
      return;
    }
    if (request.method === 'PUT' && url.searchParams.has('partNumber')) {
      partCalls++;
      response.setHeader('ETag', '"test-part"');
      response.end();
      return;
    }
    if (request.method === 'POST' && url.searchParams.has('uploadId')) {
      completeCalls++;
      response.end(
        '<CompleteMultipartUploadResult><ETag>"done"</ETag></CompleteMultipartUploadResult>',
      );
      return;
    }
    if (request.method === 'PUT' && failMetadata) {
      response.statusCode = 503;
      response.end('<Error><Code>SlowDown</Code><Message>Try later</Message></Error>');
      return;
    }
    response.setHeader('ETag', '"metadata"');
    response.end();
  });
  await new Promise<void>((resolve) => endpoint.listen(0, '127.0.0.1', resolve));
  const port = (endpoint.address() as { port: number }).port;
  const root = await mkdtemp(join(tmpdir(), 'zcloud-s3-checkpoint-'));
  const registry = new ServerRegistry(root);
  const repository = createLocalRepository(join(root, 'catalog.json'));
  let manager = new UploadManager(root, repository, registry);
  const id = randomUUID();
  try {
    const server = await registry.save(
      { name: 'Test S3', endpoint: `http://127.0.0.1:${port}`, bucket: 'test-bucket' },
      { accessKeyId: 'FAKE_ACCESS', secretAccessKey: 'FAKE_SECRET' },
    );
    const privateData = await readFile(join(root, 'servers.private.json'), 'utf8');
    assert.equal(privateData.includes('FAKE_ACCESS'), false);
    assert.equal(privateData.includes('FAKE_SECRET'), false);
    assert.equal(JSON.stringify(await registry.list()).includes('secretAccessKey'), false);
    const bytes = Buffer.from('test-file');
    await manager.create({ id, destinationId: server.id, metadata: metadata(bytes.length) });
    await manager.chunk(id, 0, bytes);
    await manager.complete(id);
    const failed = await waitFor(manager, id, 'failed');
    assert.equal(failed.remote?.completed, true);
    assert.equal(partCalls, 1);
    assert.equal(completeCalls, 1);
    await manager.close();
    failMetadata = false;
    manager = new UploadManager(root, repository, registry);
    await manager.control(id, 'resume');
    await waitFor(manager, id, 'completed');
    assert.equal(partCalls, 1);
    assert.equal(completeCalls, 1);
    assert.equal((await repository.list()).length, 1);
  } finally {
    await manager.close();
    endpoint.closeAllConnections();
    await new Promise<void>((resolve) => endpoint.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
