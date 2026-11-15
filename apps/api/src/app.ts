import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { StorageError } from '@z-cloud/storage/servers';
import { assetSchema, createAssetSchema, updateAssetSchema } from '@z-cloud/contracts';
import { EventBus, type MediaRepository } from '@z-cloud/core';
import type { MediaAsset } from '@z-cloud/contracts';
import type { UploadManager } from '@z-cloud/storage/uploads';
import { transferRoutes } from './transfers';

export function memoryRepository(): MediaRepository {
  const data = new Map<string, MediaAsset>();
  return {
    async list() {
      return [...data.values()];
    },
    async find(id) {
      return data.get(id);
    },
    async create(input, id = crypto.randomUUID()) {
      const existing = data.get(id);
      if (existing) return existing;
      const asset = { ...createAssetSchema.parse(input), id };
      data.set(asset.id, asset);
      return asset;
    },
    async update(id, patch) {
      const asset = data.get(id);
      if (!asset) return;
      const next = { ...asset, ...patch };
      data.set(id, next);
      return next;
    },
  };
}
/** Local, single-user API. Bind to loopback until authentication is implemented. */
export function createApp(
  repository: MediaRepository,
  mode: 'memory' | 'postgres' | 'local',
  events = new EventBus(),
  uploads?: UploadManager,
  origins = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:4173',
    'http://localhost:4173',
    'http://127.0.0.1:4174',
    'http://localhost:4174',
  ],
) {
  const app = new Hono();
  app.use('*', cors({ origin: origins }));
  app.use('/v1/media', bodyLimit({ maxSize: 1024 * 128 }));
  app.use('/v1/media/:id', bodyLimit({ maxSize: 1024 * 128 }));
  app.use('/v1/*', async (c, next) => {
    const origin = c.req.header('Origin');
    if (origin && !origins.includes(origin)) return c.json({ error: 'Origin not allowed' }, 403);
    if (
      ['POST', 'PATCH'].includes(c.req.method) &&
      !c.req.header('Content-Type')?.startsWith('application/json')
    )
      return c.json({ error: 'JSON content type is required' }, 415);
    await next();
  });
  app.get('/health', (c) =>
    c.json({ status: 'ok', service: 'z-cloud-api', mode, persistent: mode !== 'memory' }),
  );
  if (uploads) app.route('/v1', transferRoutes(uploads, repository));
  app.get('/v1/media', async (c) => c.json({ data: await repository.list() }));
  app.use('/v1/media/:id', async (c, next) => {
    if (!assetSchema.shape.id.safeParse(c.req.param('id')).success)
      return c.json({ error: 'Invalid media ID' }, 400);
    await next();
  });
  app.get('/v1/media/:id', async (c) => {
    const asset = await repository.find(c.req.param('id'));
    return asset ? c.json({ data: asset }) : c.json({ error: 'Media not found' }, 404);
  });
  app.post('/v1/media', async (c) => {
    const input = createAssetSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return c.json({ error: 'Invalid media', issues: input.error.issues }, 400);
    const asset = await repository.create(input.data);
    events.emit('media.imported', { asset });
    return c.json({ data: asset }, 201);
  });
  app.patch('/v1/media/:id', async (c) => {
    const input = updateAssetSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return c.json({ error: 'Invalid update', issues: input.error.issues }, 400);
    const asset = await repository.update(c.req.param('id'), input.data);
    if (!asset) return c.json({ error: 'Media not found' }, 404);
    events.emit('media.updated', { asset });
    return c.json({ data: asset });
  });
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    if (err instanceof StorageError) return c.json({ error: err.message }, err.status as 400);
    if (err instanceof ZodError)
      return c.json({ error: 'Check the supplied fields.', issues: err.issues }, 400);
    console.error('API request failed:', err.message);
    return c.json({ error: 'The request could not be completed' }, 500);
  });
  return app;
}
