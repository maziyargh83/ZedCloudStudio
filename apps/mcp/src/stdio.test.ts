import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MediaAsset } from '@z-cloud/contracts';

test('two independently launched stdio clients share durable data and survive reconnection', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'zcloud-stdio-'));
  const clients: Client[] = [];
  async function connect(actor: string) {
    const client = new Client({ name: actor, version: '1.0.0' });
    clients.push(client);
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [fileURLToPath(new URL('../dist/stdio.js', import.meta.url))],
        env: { ZCLOUD_DATA_FILE: join(dir, 'catalog.json'), ZCLOUD_ACTOR: actor, DATABASE_URL: '' },
        stderr: 'pipe',
      }),
    );
    return client;
  }
  try {
    const codex = await connect('codex-test');
    const claude = await connect('claude-test');
    assert.equal((await codex.listTools()).tools.length, 8);
    const created = await codex.callTool({
      name: 'media_register',
      arguments: {
        title: 'Shared across hosts',
        filename: 'shared.jpg',
        type: 'photo',
        mime: 'image/jpeg',
        size: 20,
        source: 'local',
        capturedAt: '2026-11-15T10:00:00.000Z',
      },
    });
    const asset = (created.structuredContent as { data: MediaAsset }).data;
    const read = await claude.callTool({ name: 'media_get', arguments: { id: asset.id } });
    assert.equal(
      (read.structuredContent as { data: MediaAsset }).data.title,
      'Shared across hosts',
    );
    await claude.callTool({
      name: 'media_update',
      arguments: { id: asset.id, patch: { favorite: true } },
    });
    await codex.close();
    const reconnected = await connect('codex-reconnected');
    const saved = await reconnected.callTool({ name: 'media_get', arguments: { id: asset.id } });
    assert.equal((saved.structuredContent as { data: MediaAsset }).data.favorite, true);
  } finally {
    await Promise.all(clients.map((c) => c.close()));
    await rm(dir, { recursive: true, force: true });
  }
});
