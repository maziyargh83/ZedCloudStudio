import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalRepository } from './local';

const input = {
  title: 'A moment',
  filename: 'test.jpg',
  type: 'photo' as const,
  mime: 'image/jpeg',
  size: 10,
  source: 'local' as const,
  capturedAt: '2026-11-15T10:00:00.000Z',
  tags: ['keep'],
  description: 'Keep this',
  favorite: false,
};
test('separate repository instances preserve concurrent writes and reload persisted metadata', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'zcloud-repository-'));
  try {
    const path = join(dir, 'library.json');
    const first = createLocalRepository(path);
    const second = createLocalRepository(path);
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        (i % 2 ? first : second).create({ ...input, title: `Moment ${i}` }),
      ),
    );
    const records = await createLocalRepository(path).list();
    assert.equal(records.length, 12);
    assert.equal(new Set(records.map((a) => a.id)).size, 12);
    await first.update(records[0].id, { favorite: true });
    const saved = await second.find(records[0].id);
    assert.equal(saved?.favorite, true);
    assert.deepEqual(saved?.tags, ['keep']);
    assert.equal(saved?.description, 'Keep this');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('a corrupt catalog fails closed without overwriting the existing file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'zcloud-corrupt-'));
  const path = join(dir, 'library.json');
  try {
    await writeFile(path, 'broken data');
    const repository = createLocalRepository(path);
    await assert.rejects(() => repository.create(input), /not overwritten/);
    assert.equal(await readFile(path, 'utf8'), 'broken data');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
