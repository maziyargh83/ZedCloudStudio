import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import lockfile from 'proper-lockfile';
import { z } from 'zod';
import {
  assetSchema,
  createAssetSchema,
  updateAssetSchema,
  type CreateAsset,
  type AssetPatch,
} from '@z-cloud/contracts';

const librarySchema = z.object({ version: z.literal(1), assets: z.array(assetSchema) });
type Library = z.infer<typeof librarySchema>;

/** Shared by API and independently spawned MCP processes; originals are never stored here. */
export function createLocalRepository(filename: string) {
  const path = resolve(filename);
  async function read(): Promise<Library> {
    try {
      return librarySchema.parse(JSON.parse(await readFile(path, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, assets: [] };
      throw new Error(
        'The local media catalog could not be read. Existing data was not overwritten.',
        { cause: error },
      );
    }
  }
  async function mutate<T>(change: (library: Library) => T): Promise<T> {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const release = await lockfile.lock(path, {
      realpath: false,
      retries: { retries: 40, minTimeout: 10, maxTimeout: 250 },
      stale: 10000,
    });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      const library = await read();
      const result = change(library);
      await writeFile(temporary, JSON.stringify(library, null, 2), { flag: 'wx', mode: 0o600 });
      await rename(temporary, path);
      return result;
    } finally {
      try {
        await rm(temporary, { force: true });
      } finally {
        await release();
      }
    }
  }
  return {
    async list() {
      return (await read()).assets.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    },
    async find(id: string) {
      return (await read()).assets.find((asset) => asset.id === id);
    },
    async create(input: CreateAsset, id: string = randomUUID()) {
      const validated = createAssetSchema.parse(input);
      return mutate((library) => {
        const existing = library.assets.find((asset) => asset.id === id);
        if (existing) return existing;
        const asset = { ...validated, id };
        library.assets.push(asset);
        return asset;
      });
    },
    async update(id: string, patch: AssetPatch) {
      const validated = updateAssetSchema.parse(patch);
      return mutate((library) => {
        const asset = library.assets.find((asset) => asset.id === id);
        if (!asset) return undefined;
        Object.assign(asset, validated);
        return asset;
      });
    },
    async compareAndUpdate(id: string, expected: AssetPatch, patch: AssetPatch) {
      const validated = updateAssetSchema.parse(patch);
      return mutate((library) => {
        const asset = library.assets.find((a) => a.id === id);
        if (
          !asset ||
          Object.entries(expected).some(
            ([k, v]) => JSON.stringify(asset[k as keyof typeof asset]) !== JSON.stringify(v),
          )
        )
          return undefined;
        Object.assign(asset, validated);
        return asset;
      });
    },
    async removeDemos() {
      return mutate((library) => {
        const count = library.assets.length;
        library.assets = library.assets.filter((a) => a.source !== 'demo');
        return count - library.assets.length;
      });
    },
  };
}
