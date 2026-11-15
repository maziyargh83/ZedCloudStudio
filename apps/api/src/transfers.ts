import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import {
  CHUNK_SIZE,
  serverInputSchema,
  serverCredentialsSchema,
  uploadMetadataSchema,
} from '@z-cloud/contracts';
import { UploadManager, publicSession } from '@z-cloud/storage/uploads';
import { StorageError } from '@z-cloud/storage/servers';
import type { MediaRepository } from '@z-cloud/core';

export function transferRoutes(manager: UploadManager, repository: MediaRepository) {
  const routes = new Hono();
  routes.use('*', async (c, next) => {
    try {
      await next();
    } catch (error) {
      if (error instanceof z.ZodError)
        return c.json({ error: 'Check the supplied fields.', issues: error.issues }, 400);
      if (error instanceof StorageError)
        return c.json({ error: error.message }, error.status as 400);
      throw error;
    }
  });
  routes.get('/servers', async (c) => c.json({ data: await manager.servers.list() }));
  routes.post('/servers', bodyLimit({ maxSize: 128 * 1024 }), async (c) => {
    const input = z
      .object({ server: serverInputSchema, credentials: serverCredentialsSchema })
      .parse(await c.req.json());
    return c.json({ data: await manager.servers.save(input.server, input.credentials) }, 201);
  });
  routes.patch('/servers/:id', bodyLimit({ maxSize: 128 * 1024 }), async (c) => {
    const id = z.uuid().parse(c.req.param('id'));
    const input = z
      .object({ server: serverInputSchema, credentials: serverCredentialsSchema.optional() })
      .parse(await c.req.json());
    const current = await manager.servers.get(id);
    if (!current) throw new StorageError('Server not found.', 404);
    const active = (await manager.list()).some(
      (job) => job.destinationId === id && !['completed', 'cancelled'].includes(job.status),
    );
    const routing = ['endpoint', 'bucket', 'region', 'prefix', 'forcePathStyle'] as const;
    if (active && routing.some((key) => current[key] !== input.server[key]))
      throw new StorageError(
        'Finish or cancel active transfers before changing their destination. Credentials can be updated now.',
        409,
      );
    return c.json({ data: await manager.servers.save(input.server, input.credentials, id) });
  });
  routes.post('/servers/:id/test', async (c) =>
    c.json({ data: await manager.servers.test(c.req.param('id')) }),
  );
  routes.get('/servers/:id/buckets', async (c) =>
    c.json({ data: await manager.servers.buckets(c.req.param('id')) }),
  );
  routes.get('/uploads', async (c) =>
    c.json({ data: (await manager.list()).slice(0, 500).map(publicSession) }),
  );
  routes.post('/uploads', bodyLimit({ maxSize: 128 * 1024 }), async (c) =>
    c.json({ data: publicSession(await manager.create(await c.req.json())) }, 201),
  );
  routes.use('/uploads/:id/*', async (c, next) => {
    z.uuid().parse(c.req.param('id'));
    await next();
  });
  routes.get('/uploads/:id', async (c) => {
    const session = await manager.get(z.uuid().parse(c.req.param('id')));
    return session
      ? c.json({ data: publicSession(session) })
      : c.json({ error: 'Upload not found.' }, 404);
  });
  routes.put('/uploads/:id/chunks/:index', bodyLimit({ maxSize: CHUNK_SIZE }), async (c) => {
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    return c.json({
      data: publicSession(
        await manager.chunk(c.req.param('id'), Number(c.req.param('index')), bytes),
      ),
    });
  });
  routes.patch('/uploads/:id', bodyLimit({ maxSize: 128 * 1024 }), async (c) => {
    const id = z.uuid().parse(c.req.param('id'));
    const input = z
      .union([
        z.object({ action: z.enum(['pause', 'resume', 'cancel']) }),
        z.object({ metadata: uploadMetadataSchema }),
      ])
      .parse(await c.req.json());
    return c.json({
      data: publicSession(
        'action' in input
          ? await manager.control(id, input.action)
          : await manager.metadata(id, input.metadata),
      ),
    });
  });
  routes.post('/uploads/:id/complete', async (c) =>
    c.json({ data: publicSession(await manager.complete(c.req.param('id'))) }, 202),
  );
  routes.get('/media/:id/content', async (c) => {
    const id = z.uuid().parse(c.req.param('id'));
    const asset = await repository.find(id);
    if (!asset || asset.source !== 'upload')
      return c.json({ error: 'Original not available on this server.' }, 404);
    let info;
    try {
      info = await stat(manager.original(id));
    } catch {
      return c.json({ error: 'The cached original is unavailable.' }, 404);
    }
    let start = 0,
      end = info.size - 1,
      partial = false;
    const range = c.req.header('Range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2]))
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${info.size}` },
        });
      if (!match[1]) {
        start = Math.max(0, info.size - Number(match[2]));
      } else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(end, Number(match[2]));
      }
      if (start > end || start >= info.size)
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${info.size}` },
        });
      partial = true;
    }
    const headers: Record<string, string> = {
      'Content-Type': asset.mime,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(asset.filename)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Cache-Control': 'private, max-age=3600',
    };
    if (partial) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    const stream = Readable.toWeb(createReadStream(manager.original(id), { start, end }));
    return new Response(stream as ReadableStream<Uint8Array>, {
      status: partial ? 206 : 200,
      headers,
    });
  });
  return routes;
}
