import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createLocalRepository } from '@z-cloud/db/local';
import type { MediaAsset } from '@z-cloud/contracts';
import { createMcpServer } from './server';

export const payload = <T>(response: Awaited<ReturnType<Client['callTool']>>) =>
  response.structuredContent as T;
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'zcloud-mcp-'));
  const server = createMcpServer({
    repository: createLocalRepository(join(dir, 'library.json')),
    mode: 'local',
    actor: 'test',
  });
  const client = new Client({ name: 'protocol-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    dir,
    async close() {
      await client.close();
      await server.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
test('protocol discovery, resources, real CRUD, search, statistics and patch preservation', async () => {
  const ctx = await setup();
  const { client } = ctx;
  try {
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 8);
    assert.equal(tools.tools.find((t) => t.name === 'media_list')?.annotations?.readOnlyHint, true);
    const resources = await client.listResources();
    assert.equal(resources.resources[0].uri, 'zcloud://guide');
    const guide = await client.readResource({ uri: 'zcloud://guide' });
    assert.match(JSON.stringify(guide), /not synchronized/);
    const context = payload<{ browserSync: boolean; mediaCount: number }>(
      await client.callTool({ name: 'zcloud_context', arguments: {} }),
    );
    assert.equal(context.browserSync, false);
    assert.equal(context.mediaCount, 0);
    const registered = payload<{ data: MediaAsset }>(
      await client.callTool({
        name: 'media_register',
        arguments: {
          title: 'یادگاری کوه',
          filename: 'mountain.jpg',
          type: 'photo',
          mime: 'image/jpeg',
          size: 1024,
          source: 'local',
          capturedAt: '2026-11-15T10:00:00.000Z',
          tags: ['alpine'],
          description: 'Keep me',
        },
      }),
    ).data;
    await client.callTool({
      name: 'media_update',
      arguments: { id: registered.id, patch: { favorite: true } },
    });
    const saved = payload<{ data: MediaAsset }>(
      await client.callTool({ name: 'media_get', arguments: { id: registered.id } }),
    ).data;
    assert.deepEqual(saved.tags, ['alpine']);
    assert.equal(saved.description, 'Keep me');
    assert.equal(saved.favorite, true);
    const search = payload<{ total: number; data: MediaAsset[] }>(
      await client.callTool({
        name: 'media_list',
        arguments: { query: 'يادگاري', favorite: true, tag: 'alpine', limit: 1 },
      }),
    );
    assert.equal(search.total, 1);
    assert.equal(search.data[0].id, registered.id);
    const stats = payload<{ total: number; indexedBytes: number }>(
      await client.callTool({ name: 'library_stats', arguments: {} }),
    );
    assert.equal(stats.total, 1);
    assert.equal(stats.indexedBytes, 1024);
    const invalid = await client.callTool({
      name: 'media_update',
      arguments: { id: registered.id, patch: {} },
    });
    assert.equal(invalid.isError, true);
  } finally {
    await ctx.close();
  }
});
test('file indexing reads metadata only, keeps originals, and rejects symlinks and unsupported files', async () => {
  const ctx = await setup();
  const { client } = ctx;
  try {
    const path = join(ctx.dir, 'moment.jpg');
    await writeFile(path, 'untouched-original');
    const first = payload<{ data: MediaAsset; created: boolean; originalUploaded: boolean }>(
      await client.callTool({ name: 'media_index_file', arguments: { path } }),
    );
    assert.equal(first.created, true);
    assert.equal(first.originalUploaded, false);
    assert.equal(first.data.size, 18);
    const repeated = payload<{ created: boolean }>(
      await client.callTool({ name: 'media_index_file', arguments: { path } }),
    );
    assert.equal(repeated.created, false);
    const link = join(ctx.dir, 'link.jpg');
    await symlink(path, link);
    const denied = payload<{ error: string }>(
      await client.callTool({ name: 'media_index_file', arguments: { path: link } }),
    );
    assert.match(denied.error, /symbolic links/);
    const text = join(ctx.dir, 'note.txt');
    await writeFile(text, 'private');
    const unsupported = payload<{ error: string }>(
      await client.callTool({ name: 'media_index_file', arguments: { path: text } }),
    );
    assert.match(unsupported.error, /Unsupported/);
  } finally {
    await ctx.close();
  }
});
