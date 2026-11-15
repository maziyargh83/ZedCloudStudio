import { randomBytes, createCipheriv, createDecipheriv, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import lockfile from 'proper-lockfile';
import { z } from 'zod';
import { S3Client, ListBucketsCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import {
  serverInputSchema,
  serverCredentialsSchema,
  storageServerSchema,
  type StorageServer,
} from '@z-cloud/contracts';

const privateRecordSchema = z.object({
  server: storageServerSchema,
  credentials: z.object({ iv: z.string(), tag: z.string(), value: z.string() }),
});
const vaultSchema = z.object({ version: z.literal(1), records: z.array(privateRecordSchema) });
type Vault = z.infer<typeof vaultSchema>;
type Credentials = z.infer<typeof serverCredentialsSchema>;
export class StorageError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const localServer: StorageServer = {
  id: 'local',
  kind: 'local',
  name: 'This server',
  endpoint: 'http://127.0.0.1:4877',
  region: 'local',
  bucket: '',
  prefix: '',
  forcePathStyle: true,
  enabled: true,
  credentialsConfigured: false,
  connectionStatus: 'connected',
  connectionMessage: 'Files are stored on the API server.',
};

export class ServerRegistry {
  readonly root: string;
  private filename: string;
  constructor(root: string) {
    this.root = resolve(root);
    this.filename = join(this.root, 'servers.private.json');
  }
  private async key() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const path = join(this.root, 'servers.key');
    try {
      await writeFile(path, randomBytes(32), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const key = await readFile(path);
    if (key.length !== 32) throw new StorageError('The server credential key is invalid.', 500);
    return key;
  }
  private async encrypt(credentials: Credentials) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', await this.key(), iv);
    const value = Buffer.concat([cipher.update(JSON.stringify(credentials)), cipher.final()]);
    return {
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      value: value.toString('base64'),
    };
  }
  private async read(): Promise<Vault> {
    try {
      return vaultSchema.parse(JSON.parse(await readFile(this.filename, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, records: [] };
      throw new StorageError(
        'Server settings could not be read. Existing settings were preserved.',
        500,
      );
    }
  }
  private async change<T>(update: (vault: Vault) => T | Promise<T>) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const release = await lockfile.lock(this.filename, {
      realpath: false,
      retries: { retries: 30, minTimeout: 10, maxTimeout: 200 },
    });
    const temporary = `${this.filename}.${randomUUID()}.tmp`;
    try {
      const vault = await this.read();
      const result = await update(vault);
      await writeFile(temporary, JSON.stringify(vault, null, 2), { flag: 'wx', mode: 0o600 });
      await rename(temporary, this.filename);
      return result;
    } finally {
      try {
        await rm(temporary, { force: true });
      } finally {
        await release();
      }
    }
  }
  async list() {
    return [localServer, ...(await this.read()).records.map((record) => record.server)];
  }
  async get(id: string) {
    return (await this.list()).find((server) => server.id === id);
  }
  async credentials(id: string): Promise<Credentials> {
    const record = (await this.read()).records.find((record) => record.server.id === id);
    if (!record) throw new StorageError('Server not found.', 404);
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        await this.key(),
        Buffer.from(record.credentials.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(record.credentials.tag, 'base64'));
      return serverCredentialsSchema.parse(
        JSON.parse(
          Buffer.concat([
            decipher.update(Buffer.from(record.credentials.value, 'base64')),
            decipher.final(),
          ]).toString('utf8'),
        ),
      );
    } catch {
      throw new StorageError(
        'Server credentials could not be opened. Re-enter them in server settings.',
        500,
      );
    }
  }
  async save(input: unknown, credentials?: Credentials, id: string = randomUUID()) {
    const fields = serverInputSchema.parse(input);
    const encrypted = credentials
      ? await this.encrypt(serverCredentialsSchema.parse(credentials))
      : undefined;
    return this.change((vault) => {
      const index = vault.records.findIndex((record) => record.server.id === id);
      if (index < 0 && !encrypted)
        throw new StorageError('Access key and secret key are required.');
      const server: StorageServer = {
        ...fields,
        id,
        kind: 's3',
        credentialsConfigured: true,
        connectionStatus: 'unchecked',
      };
      const record = { server, credentials: encrypted ?? vault.records[index].credentials };
      if (index < 0) vault.records.push(record);
      else vault.records[index] = record;
      return server;
    });
  }
  async client(id: string, target?: z.infer<typeof serverInputSchema>) {
    const server = await this.get(id);
    if (!server || server.kind !== 's3') throw new StorageError('S3 server not found.', 404);
    if (!server.enabled)
      throw new StorageError('This server is disabled. Enable it before continuing.', 409);
    const config = target ?? server;
    return new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: await this.credentials(id),
      maxAttempts: 3,
      requestHandler: { connectionTimeout: 5000, socketTimeout: 30000 },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  async buckets(id: string) {
    const client = await this.client(id);
    try {
      const result = await client.send(new ListBucketsCommand({}));
      return (result.Buckets ?? []).flatMap((bucket) => (bucket.Name ? [bucket.Name] : []));
    } catch {
      throw new StorageError(
        'Buckets could not be listed. Check the endpoint, keys and bucket permissions.',
        502,
      );
    } finally {
      client.destroy();
    }
  }
  async test(id: string) {
    if (id === 'local') return localServer;
    const server = await this.get(id);
    if (!server) throw new StorageError('Server not found.', 404);
    const client = await this.client(id);
    let status: 'connected' | 'error' = 'connected';
    let message = 'Connection verified.';
    try {
      if (server.bucket) await client.send(new HeadBucketCommand({ Bucket: server.bucket }));
      else await client.send(new ListBucketsCommand({}));
    } catch {
      status = 'error';
      message =
        'Connection failed. Check the endpoint, region, credentials and bucket permissions.';
    } finally {
      client.destroy();
    }
    return this.change((vault) => {
      const record = vault.records.find((record) => record.server.id === id)!;
      record.server.connectionStatus = status;
      record.server.connectionMessage = message;
      record.server.lastCheckedAt = new Date().toISOString();
      return record.server;
    });
  }
}
