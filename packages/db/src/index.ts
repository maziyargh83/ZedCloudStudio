import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, desc } from 'drizzle-orm';
import { assets } from './schema';
import type { AssetPatch, CreateAsset, MediaAsset } from '@z-cloud/contracts';
const normalize = (row: typeof assets.$inferSelect): MediaAsset => ({
  ...row,
  sourcePath: row.sourcePath ?? undefined,
  width: row.width ?? undefined,
  height: row.height ?? undefined,
  collectionId: row.collectionId ?? undefined,
  collectionName: row.collectionName ?? undefined,
  destinationId: row.destinationId ?? undefined,
  objectKey: row.objectKey ?? undefined,
  capturedAt: new Date(row.capturedAt).toISOString(),
});
export function createDatabase(url: string) {
  const client = postgres(url, { max: 5 });
  const db = drizzle(client);
  return {
    repository: {
      async list() {
        return (await db.select().from(assets).orderBy(desc(assets.capturedAt))).map(normalize);
      },
      async find(id: string) {
        const [row] = await db.select().from(assets).where(eq(assets.id, id));
        return row && normalize(row);
      },
      async create(input: CreateAsset, id?: string) {
        const [row] = await db
          .insert(assets)
          .values({ ...input, ...(id ? { id } : {}) })
          .onConflictDoNothing({ target: assets.id })
          .returning();
        if (row) return normalize(row);
        const [existing] = await db.select().from(assets).where(eq(assets.id, id!));
        if (!existing) throw new Error('The media record could not be stored');
        return normalize(existing);
      },
      async update(id: string, patch: AssetPatch) {
        const [row] = await db.update(assets).set(patch).where(eq(assets.id, id)).returning();
        return row && normalize(row);
      },
      async compareAndUpdate(id: string, expected: AssetPatch, patch: AssetPatch) {
        return db.transaction(async (tx) => {
          const [row] = await tx.select().from(assets).where(eq(assets.id, id)).for('update');
          if (!row) return undefined;
          const current = normalize(row);
          if (
            Object.entries(expected).some(
              ([k, v]) => JSON.stringify(current[k as keyof MediaAsset]) !== JSON.stringify(v),
            )
          )
            return undefined;
          const [updated] = await tx.update(assets).set(patch).where(eq(assets.id, id)).returning();
          return normalize(updated);
        });
      },
      async removeDemos() {
        const rows = await db
          .delete(assets)
          .where(eq(assets.source, 'demo'))
          .returning({ id: assets.id });
        return rows.length;
      },
    },
    close: () => client.end(),
  };
}
