import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import lockfile from 'proper-lockfile';
import { workspaceSchema, type WorkspaceData } from '@z-cloud/contracts';

/** Durable workspace journal, separate from originals and credentials, shared across API restarts. */
export function createWorkspaceStore(filename: string) {
  const path = resolve(filename);
  async function read(): Promise<WorkspaceData> {
    try {
      return workspaceSchema.parse(JSON.parse(await readFile(path, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return workspaceSchema.parse({ version: 1, trips: [], reviews: [] });
      throw new Error('Workspace data could not be read. Existing data was not overwritten.');
    }
  }
  async function mutate<T>(fn: (data: WorkspaceData) => T | Promise<T>): Promise<T> {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const release = await lockfile.lock(path, {
      realpath: false,
      retries: { retries: 40, minTimeout: 10, maxTimeout: 250 },
      stale: 10000,
    });
    const tmp = `${path}.${randomUUID()}.tmp`;
    try {
      const data = await read();
      const result = await fn(data);
      const valid = workspaceSchema.parse(data);
      await writeFile(tmp, JSON.stringify(valid), { flag: 'wx', mode: 0o600 });
      await rename(tmp, path);
      return result;
    } finally {
      try {
        await rm(tmp, { force: true });
      } finally {
        await release();
      }
    }
  }
  return { read, mutate };
}
export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;
