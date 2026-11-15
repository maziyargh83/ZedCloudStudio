import { mkdir, readFile, writeFile, rename, rm, readdir, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import lockfile from 'proper-lockfile';
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  CHUNK_SIZE,
  createUploadSchema,
  uploadSessionSchema,
  type UploadSession,
  type PublicUploadSession,
  type UploadMetadata,
} from '@z-cloud/contracts';
import type { MediaRepository } from '@z-cloud/core';
import { ServerRegistry, StorageError } from './servers';

const terminal = (status: string) => ['completed', 'cancelled'].includes(status);
export function publicSession(session: UploadSession): PublicUploadSession {
  const { target: _target, remote: _remote, generation: _generation, chunks, ...safe } = session;
  return {
    ...safe,
    receivedChunks: chunks.map((chunk) => chunk.index),
    chunkHashes: Object.fromEntries(chunks.map((chunk) => [String(chunk.index), chunk.hash])),
    chunkSize: CHUNK_SIZE,
  };
}
export class UploadManager {
  readonly root: string;
  private active = new Map<string, AbortController>();
  private work = new Map<string, Promise<void>>();
  private pumping = false;
  private closed = false;
  constructor(
    root: string,
    private repository: MediaRepository,
    readonly servers: ServerRegistry,
  ) {
    this.root = resolve(root);
  }
  private folder(id: string) {
    return join(this.root, 'uploads', id);
  }
  private file(id: string) {
    return join(this.folder(id), 'session.json');
  }
  original(id: string) {
    return join(this.root, 'originals', id);
  }
  async get(id: string): Promise<UploadSession | undefined> {
    try {
      return uploadSessionSchema.parse(JSON.parse(await readFile(this.file(id), 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw new StorageError('Upload state could not be read. Existing files were preserved.', 500);
    }
  }
  async list() {
    let ids: string[];
    try {
      ids = await readdir(join(this.root, 'uploads'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const sessions = await Promise.all(
      ids.filter((id) => /^[0-9a-f-]{36}$/.test(id)).map((id) => this.get(id)),
    );
    return sessions
      .filter((session): session is UploadSession => Boolean(session))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  private async change<T>(
    id: string,
    update: (
      session: UploadSession | undefined,
    ) => Promise<{ session: UploadSession; result: T }> | { session: UploadSession; result: T },
  ) {
    await mkdir(this.folder(id), { recursive: true, mode: 0o700 });
    const release = await lockfile.lock(this.file(id), {
      realpath: false,
      retries: { retries: 60, minTimeout: 10, maxTimeout: 200 },
      stale: 10000,
    });
    const temporary = `${this.file(id)}.${randomUUID()}.tmp`;
    try {
      const { session, result } = await update(await this.get(id));
      session.updatedAt = new Date().toISOString();
      await writeFile(temporary, JSON.stringify(uploadSessionSchema.parse(session)), {
        flag: 'wx',
        mode: 0o600,
      });
      await rename(temporary, this.file(id));
      return result;
    } finally {
      try {
        await rm(temporary, { force: true });
      } finally {
        await release();
      }
    }
  }
  async create(input: unknown) {
    const request = createUploadSchema.parse(input);
    const destination = await this.servers.get(request.destinationId);
    if (!destination || !destination.enabled)
      throw new StorageError('Choose an enabled storage server.', 409);
    if (destination.kind === 's3' && (!destination.bucket || !destination.credentialsConfigured))
      throw new StorageError('Select a bucket and configure this server before uploading.', 409);
    const safeTypes =
      /^(image\/(jpeg|png|webp|avif|gif|heic|heif|tiff)|video\/[\w.+-]+|audio\/[\w.+-]+)$/i;
    if (!safeTypes.test(request.metadata.mime))
      throw new StorageError('This media type is not supported.');
    return this.change(request.id, async (existing) => {
      if (existing) {
        if (
          existing.destinationId !== request.destinationId ||
          existing.metadata.filename !== request.metadata.filename ||
          existing.metadata.size !== request.metadata.size ||
          existing.metadata.mime !== request.metadata.mime
        )
          throw new StorageError('This upload ID belongs to a different file or destination.', 409);
        return { session: existing, result: existing };
      }
      if (await this.repository.find(request.id))
        throw new StorageError('This media ID is already registered.', 409);
      const now = new Date().toISOString();
      const filename =
        request.metadata.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180) || 'media';
      const session: UploadSession = {
        ...request,
        destinationName: destination.name,
        status: 'uploading',
        phase: 'receiving',
        chunks: [],
        receivedBytes: 0,
        destinationBytes: 0,
        generation: 0,
        createdAt: now,
        updatedAt: now,
        ...(destination.kind === 's3'
          ? {
              target: destination,
              objectKey: `${destination.prefix.replace(/\/?$/, '/')}media/${request.id}/${filename}`,
            }
          : {}),
      };
      return { session, result: session };
    });
  }
  async chunk(id: string, index: number, bytes: Uint8Array) {
    return this.change(id, async (session) => {
      if (!session) throw new StorageError('Upload not found.', 404);
      if (session.status !== 'uploading' || session.phase !== 'receiving')
        throw new StorageError('Resume this upload before sending more data.', 409);
      const count = Math.ceil(session.metadata.size / CHUNK_SIZE);
      const expected = Math.min(CHUNK_SIZE, session.metadata.size - index * CHUNK_SIZE);
      if (!Number.isInteger(index) || index < 0 || index >= count || bytes.byteLength !== expected)
        throw new StorageError('The upload chunk has an unexpected size or index.');
      const hash = createHash('sha256').update(bytes).digest('hex');
      const previous = session.chunks.find((chunk) => chunk.index === index);
      if (previous) {
        if (previous.hash !== hash)
          throw new StorageError('This chunk differs from the data already received.', 409);
        return { session, result: session };
      }
      const folder = join(this.folder(id), 'chunks');
      await mkdir(folder, { recursive: true, mode: 0o700 });
      const destination = join(folder, String(index));
      const temporary = `${destination}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
        await rename(temporary, destination);
      } finally {
        await rm(temporary, { force: true });
      }
      session.chunks.push({ index, size: bytes.byteLength, hash });
      session.receivedBytes += bytes.byteLength;
      return { session, result: session };
    });
  }
  async metadata(id: string, metadata: UploadMetadata) {
    return this.change(id, (session) => {
      if (!session) throw new StorageError('Upload not found.', 404);
      if (!['paused', 'failed'].includes(session.status) || session.remote?.uploadId)
        throw new StorageError(
          'Pause this upload before editing. Metadata is fixed after transfer to S3 begins.',
          409,
        );
      if (
        metadata.filename !== session.metadata.filename ||
        metadata.mime !== session.metadata.mime ||
        metadata.size !== session.metadata.size
      )
        throw new StorageError('The original file cannot be changed.', 409);
      session.metadata = metadata;
      return { session, result: session };
    });
  }
  async control(id: string, action: 'pause' | 'resume' | 'cancel') {
    const running = this.work.get(id);
    this.active.get(id)?.abort();
    const session = await this.change(id, (current) => {
      if (!current) throw new StorageError('Upload not found.', 404);
      if (terminal(current.status)) return { session: current, result: current };
      if (action === 'cancel' && current.remote?.completed)
        throw new StorageError(
          'The file has reached its destination. Resume to finish registration.',
          409,
        );
      current.generation++;
      current.error = undefined;
      current.status =
        action === 'pause'
          ? 'paused'
          : action === 'cancel'
            ? 'cancelled'
            : current.receivedBytes === current.metadata.size
              ? 'queued'
              : 'uploading';
      if (action === 'resume')
        current.phase = current.receivedBytes === current.metadata.size ? 'waiting' : 'receiving';
      return { session: current, result: current };
    });
    if (action === 'cancel') await running;
    if (action === 'cancel' && session.remote && !session.remote.completed) {
      try {
        const client = await this.servers.client(session.destinationId, session.target);
        try {
          await client.send(
            new AbortMultipartUploadCommand({
              Bucket: session.target!.bucket,
              Key: session.objectKey,
              UploadId: session.remote.uploadId,
            }),
          );
        } finally {
          client.destroy();
        }
      } catch {
        return this.change(id, (current) => {
          if (!current) throw new StorageError('Upload not found.', 404);
          current.status = 'failed';
          current.error =
            'The remote multipart upload could not be cancelled. Retry cancellation to clean it up.';
          return { session: current, result: current };
        });
      }
    }
    if (action === 'cancel') {
      await rm(join(this.folder(id), 'chunks'), { recursive: true, force: true });
      if (!(await this.repository.find(id))) await rm(this.original(id), { force: true });
    }
    if (action === 'resume') this.kick();
    return session;
  }
  async complete(id: string) {
    const session = await this.change(id, (current) => {
      if (!current) throw new StorageError('Upload not found.', 404);
      if (terminal(current.status)) return { session: current, result: current };
      if (current.status === 'paused')
        throw new StorageError('Resume this upload before continuing.', 409);
      if (
        current.receivedBytes !== current.metadata.size ||
        current.chunks.length !== Math.ceil(current.metadata.size / CHUNK_SIZE)
      )
        throw new StorageError('Some file chunks have not arrived yet.', 409);
      current.status = 'queued';
      current.phase = 'waiting';
      current.error = undefined;
      return { session: current, result: current };
    });
    this.kick();
    return session;
  }
  async recover() {
    for (const session of await this.list())
      if (session.status === 'uploading' && session.phase !== 'receiving')
        await this.change(session.id, (current) => {
          current!.status = 'queued';
          current!.generation++;
          return { session: current!, result: undefined };
        });
    this.kick();
  }
  private kick() {
    if (!this.closed) void this.pump().catch(() => {});
  }
  private async pump() {
    if (this.pumping || this.closed) return;
    this.pumping = true;
    try {
      for (const session of (await this.list()).reverse()) {
        if (this.closed || this.active.size >= 2) break;
        if (session.status !== 'queued' || this.active.has(session.id)) continue;
        const controller = new AbortController();
        this.active.set(session.id, controller);
        const task = this.run(session, controller).finally(() => {
          this.active.delete(session.id);
          this.work.delete(session.id);
          this.kick();
        });
        this.work.set(session.id, task);
      }
    } finally {
      this.pumping = false;
    }
  }
  private async run(initial: UploadSession, controller: AbortController) {
    const id = initial.id,
      generation = initial.generation;
    const update = (change: (session: UploadSession) => void) =>
      this.change(id, (session) => {
        if (!session || session.generation !== generation || controller.signal.aborted)
          throw new Error('Transfer interrupted');
        change(session);
        return { session, result: session };
      });
    let client: Awaited<ReturnType<ServerRegistry['client']>> | undefined;
    try {
      let session = await update((current) => {
        current.status = 'uploading';
        current.phase = 'preparing';
      });
      await mkdir(join(this.root, 'originals'), { recursive: true, mode: 0o700 });
      if (!session.contentHash) {
        const hash = createHash('sha256');
        const directory = this.folder(id);
        const chunks = [...session.chunks].sort((a, b) => a.index - b.index);
        const temporary = `${this.original(id)}.${randomUUID()}.tmp`;
        async function* content() {
          for (const chunk of chunks)
            for await (const data of createReadStream(
              join(directory, 'chunks', String(chunk.index)),
            )) {
              hash.update(data);
              yield data;
            }
        }
        try {
          await pipeline(
            Readable.from(content()),
            createWriteStream(temporary, { flags: 'wx', mode: 0o600 }),
            { signal: controller.signal },
          );
          await rename(temporary, this.original(id));
        } finally {
          await rm(temporary, { force: true });
        }
        session = await update((current) => {
          current.contentHash = hash.digest('hex');
        });
      }
      if (session.target) {
        client = await this.servers.client(session.destinationId, session.target);
        if (!session.remote) {
          const created = await client.send(
            new CreateMultipartUploadCommand({
              Bucket: session.target.bucket,
              Key: session.objectKey,
              ContentType: session.metadata.mime,
              Metadata: { 'zcloud-id': id, 'zcloud-sha256': session.contentHash! },
            }),
            { abortSignal: controller.signal },
          );
          if (!created.UploadId) throw new Error('Multipart upload could not be started');
          session = await update((current) => {
            current.remote = { uploadId: created.UploadId!, parts: [], completed: false };
          });
        }
        session = await update((current) => {
          current.phase = 'destination';
        });
        if (!session.remote!.completed) {
          for (const chunk of [...session.chunks].sort((a, b) => a.index - b.index)) {
            controller.signal.throwIfAborted();
            if (session.remote!.parts.some((part) => part.number === chunk.index + 1)) continue;
            const bytes = await readFile(join(this.folder(id), 'chunks', String(chunk.index)));
            const part = await client.send(
              new UploadPartCommand({
                Bucket: session.target!.bucket,
                Key: session.objectKey,
                UploadId: session.remote!.uploadId,
                PartNumber: chunk.index + 1,
                Body: bytes,
                ContentLength: bytes.byteLength,
              }),
              { abortSignal: controller.signal },
            );
            if (!part.ETag) throw new Error('The destination did not acknowledge a part');
            session = await update((current) => {
              current.remote!.parts.push({
                number: chunk.index + 1,
                etag: part.ETag!,
                size: bytes.byteLength,
              });
              current.destinationBytes = current.remote!.parts.reduce(
                (sum, item) => sum + item.size,
                0,
              );
            });
          }
          try {
            await client.send(
              new CompleteMultipartUploadCommand({
                Bucket: session.target!.bucket,
                Key: session.objectKey,
                UploadId: session.remote!.uploadId,
                MultipartUpload: {
                  Parts: session
                    .remote!.parts.sort((a, b) => a.number - b.number)
                    .map((part) => ({ PartNumber: part.number, ETag: part.etag })),
                },
              }),
              { abortSignal: controller.signal },
            );
          } catch (error) {
            controller.signal.throwIfAborted();
            const head = await client
              .send(
                new HeadObjectCommand({ Bucket: session.target!.bucket, Key: session.objectKey }),
                { abortSignal: controller.signal },
              )
              .catch(() => undefined);
            if (
              !head ||
              head.ContentLength !== session.metadata.size ||
              head.Metadata?.['zcloud-id'] !== id ||
              head.Metadata?.['zcloud-sha256'] !== session.contentHash
            )
              throw error;
          }
          session = await update((current) => {
            current.remote!.completed = true;
          });
        }
        session = await update((current) => {
          current.phase = 'registering';
        });
        const metadata = Buffer.from(
          JSON.stringify(
            { version: 1, assetId: id, sha256: session.contentHash, ...session.metadata },
            null,
            2,
          ),
        );
        await client.send(
          new PutObjectCommand({
            Bucket: session.target!.bucket,
            Key: `${session.objectKey}.metadata.json`,
            Body: metadata,
            ContentType: 'application/json',
            ContentLength: metadata.length,
          }),
          { abortSignal: controller.signal },
        );
      } else
        session = await update((current) => {
          current.destinationBytes = current.metadata.size;
          current.phase = 'registering';
        });
      controller.signal.throwIfAborted();
      await this.repository.create(
        {
          ...session.metadata,
          source: 'upload',
          sourcePath: this.original(id),
          destinationId: session.destinationId,
          objectKey: session.objectKey,
        },
        id,
      );
      await update((current) => {
        current.status = 'completed';
        current.phase = 'done';
        current.destinationBytes = current.metadata.size;
        current.error = undefined;
      });
      await rm(join(this.folder(id), 'chunks'), { recursive: true, force: true });
    } catch {
      if (!controller.signal.aborted)
        await this.change(id, (session) => {
          if (!session) throw new StorageError('Upload not found.', 404);
          if (session.generation === generation && !terminal(session.status)) {
            session.status = 'failed';
            session.error =
              'Transfer could not finish. Your staged data is safe; check the destination and retry.';
          }
          return { session, result: undefined };
        }).catch(() => {});
    } finally {
      client?.destroy();
    }
  }
  async close() {
    this.closed = true;
    for (const controller of this.active.values()) controller.abort();
    await Promise.allSettled(this.work.values());
  }
}
