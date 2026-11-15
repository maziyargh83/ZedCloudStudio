import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkspaceStore } from '@z-cloud/db/workspace';
import { createLocalRepository } from '@z-cloud/db/local';
import { createApp } from './app';
import { tripPatchSchema } from '@z-cloud/contracts';
import { ruleQuestions } from '@z-cloud/core';
const headers = { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:4878' };
test('trip patches never reset omitted logs, gear, dates or routes', () => {
  assert.deepEqual(
    tripPatchSchema.parse({ revision: 3, patch: { summary: 'Only this change' } }).patch,
    { summary: 'Only this change' },
  );
});
test('partial AI questions keep missing fields covered and never write inferred answers', async () => {
  const t = await setup();
  try {
    const asset = await t.repository.create({
      title: 'photo',
      filename: 'photo.jpg',
      type: 'photo',
      mime: 'image/jpeg',
      size: 1,
      source: 'local',
      capturedAt: new Date().toISOString(),
    });
    let valid = true;
    const gateway = {
      async *generate() {
        yield valid
          ? JSON.stringify({
              questions: [
                {
                  field: 'title',
                  question: 'What title would help you remember this?',
                  hint: 'Use your own words.',
                },
              ],
            })
          : 'invalid provider output';
      },
    };
    const app = createApp(
      t.repository,
      'local',
      undefined,
      undefined,
      undefined,
      { gateway, model: 'test' },
      t.store,
    );
    const response = await app.request(`/v1/reviews/${asset.id}/questions`, {
      method: 'POST',
      headers,
      body: '{}',
    });
    assert.equal(response.status, 200);
    const review = (await response.json()).data;
    assert.equal(review.questionSource, 'mixed');
    assert.equal(review.questions.length, ruleQuestions(asset).length);
    assert.deepEqual(review.answers, {});
    assert.equal((await t.repository.find(asset.id))?.title, 'photo');
    valid = false;
    assert.equal(
      (
        await app.request(`/v1/reviews/${asset.id}/questions`, {
          method: 'POST',
          headers,
          body: '{}',
        })
      ).status,
      502,
    );
    assert.deepEqual((await t.store.read()).reviews[0].questions, review.questions);
  } finally {
    await rm(t.dir, { recursive: true, force: true });
  }
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'zcloud-workflow-'));
  const repository = createLocalRepository(join(dir, 'library.json'));
  const store = createWorkspaceStore(join(dir, 'workspace.json'));
  const app = createApp(repository, 'local', undefined, undefined, undefined, undefined, store);
  return { dir, repository, store, app };
}
test('metadata reviews persist drafts, require confirmation and reject stale writes', async () => {
  const t = await setup();
  try {
    const asset = await t.repository.create({
      title: 'photo',
      filename: 'photo.png',
      type: 'photo',
      mime: 'image/png',
      size: 10,
      source: 'local',
      capturedAt: '2026-11-01T12:00:00.000Z',
    });
    let list = (await (await t.app.request('/v1/reviews')).json()).data;
    assert.equal(list[0].review.questions.length, 5);
    let review = list[0].review;
    const answers = {
      title: 'A remembered morning',
      description: 'My own recollection',
      tags: ['camping'],
      location: 'Shiraz',
      capturedAt: asset.capturedAt,
    };
    let response = await t.app.request(`/v1/reviews/${asset.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ action: 'save', revision: review.revision, answers, skipped: [] }),
    });
    assert.equal(response.status, 200);
    review = (await response.json()).data;
    assert.equal((await t.repository.find(asset.id))?.title, 'photo');
    assert.equal(
      (await createWorkspaceStore(join(t.dir, 'workspace.json')).read()).reviews[0].status,
      'draft',
    );
    response = await t.app.request(`/v1/reviews/${asset.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ action: 'apply', revision: review.revision }),
    });
    assert.equal(response.status, 200);
    assert.equal((await t.repository.find(asset.id))?.title, answers.title);
    assert.equal(
      (await (await t.app.request('/v1/reviews')).json()).data[0].review.status,
      'complete',
    );
    await t.repository.update(asset.id, { title: 'Changed elsewhere' });
    response = await t.app.request(`/v1/reviews/${asset.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ action: 'apply', revision: review.revision }),
    });
    assert.equal(response.status, 409);
    assert.equal((await t.repository.find(asset.id))?.title, 'Changed elsewhere');
    assert.equal(
      await t.repository.compareAndUpdate(asset.id, { title: 'stale' }, { title: 'overwrite' }),
      undefined,
    );
  } finally {
    await rm(t.dir, { recursive: true, force: true });
  }
});
test('trip wiki, gear, typed recordings and revisions survive independent store instances', async () => {
  const t = await setup();
  try {
    let response = await t.app.request('/v1/trips', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'My trip', startDate: '2026-10-01', endDate: '2026-10-03' }),
    });
    assert.equal(response.status, 201);
    let trip = (await response.json()).data;
    response = await t.app.request(`/v1/trips/${trip.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        revision: 0,
        patch: {
          gear: [{ id: crypto.randomUUID(), name: 'Tent', quantity: 1, grams: 1700, packed: true }],
          tracks: [
            {
              id: crypto.randomUUID(),
              title: 'Real GPX',
              kind: 'recorded',
              points: [
                { lat: 29, lng: 52, time: '2026-10-01T10:00:00Z', segment: 0 },
                { lat: 30, lng: 53, time: '2026-10-03T10:00:00Z', segment: 1 },
              ],
            },
          ],
        },
      }),
    });
    assert.equal(response.status, 200);
    trip = (await response.json()).data;
    assert.equal(
      (await createWorkspaceStore(join(t.dir, 'workspace.json')).read()).trips[0].gear[0].name,
      'Tent',
    );
    response = await t.app.request(`/v1/trips/${trip.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ revision: 0, patch: { title: 'Stale edit' } }),
    });
    assert.equal(response.status, 409);
    response = await t.app.request(`/v1/trips/${trip.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        revision: 1,
        patch: { startDate: '2026-11-01', endDate: '2026-10-01' },
      }),
    });
    assert.equal(response.status, 400);
    response = await t.app.request(`/v1/trips/${trip.id}/story`, {
      method: 'POST',
      headers,
      body: '{}',
    });
    assert.equal(response.status, 400);
    const other = createWorkspaceStore(join(t.dir, 'workspace.json'));
    await Promise.all([
      t.store.mutate((d) => {
        d.trips[0].summary = 'One';
      }),
      other.mutate((d) => {
        d.trips[0].destination = 'Two';
      }),
    ]);
    const stored = (await t.store.read()).trips[0];
    assert.equal(stored.summary, 'One');
    assert.equal(stored.destination, 'Two');
    await writeFile(join(t.dir, 'workspace.json'), 'not JSON');
    await assert.rejects(() =>
      t.store.mutate((d) => {
        d.trips = [];
      }),
    );
  } finally {
    await rm(t.dir, { recursive: true, force: true });
  }
});
