import { readdir, stat, writeFile, realpath } from 'node:fs/promises';
import { resolve, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
const kinds: Record<string, { type: 'photo' | 'video' | 'audio'; mime: string }> = {
  '.jpg': { type: 'photo', mime: 'image/jpeg' },
  '.jpeg': { type: 'photo', mime: 'image/jpeg' },
  '.png': { type: 'photo', mime: 'image/png' },
  '.webp': { type: 'photo', mime: 'image/webp' },
  '.mp4': { type: 'video', mime: 'video/mp4' },
  '.mov': { type: 'video', mime: 'video/quicktime' },
  '.webm': { type: 'video', mime: 'video/webm' },
  '.mp3': { type: 'audio', mime: 'audio/mpeg' },
  '.wav': { type: 'audio', mime: 'audio/wav' },
};
async function main() {
  const directory = process.argv[2];
  const output = process.argv[3];
  if (!directory || !output)
    throw new Error('Usage: pnpm import:local /path/to/media /path/to/manifest.json');
  const root = await realpath(resolve(directory));
  const destination = resolve(output);
  const files: unknown[] = [];
  const skipped: string[] = [];
  async function walk(path: string) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const absolute = resolve(path, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      const kind = kinds[extname(entry.name).toLowerCase()];
      if (!kind) continue;
      try {
        const info = await stat(absolute);
        const fingerprint = createHash('sha256')
          .update(`${absolute}:${info.size}:${info.mtimeMs}`)
          .digest('hex');
        files.push({
          fingerprint,
          title: basename(entry.name, extname(entry.name)),
          filename: entry.name,
          ...kind,
          source: 'local',
          sourcePath: absolute,
          size: info.size,
          capturedAt: info.mtime.toISOString(),
          tags: [],
          description: '',
          favorite: false,
        });
      } catch {
        skipped.push(absolute);
      }
    }
  }
  await walk(root);
  await writeFile(
    destination,
    JSON.stringify(
      { version: 1, indexedAt: new Date().toISOString(), root, files, skipped },
      null,
      2,
    ),
    { flag: 'wx' },
  );
  console.log(
    `Indexed ${files.length} files. Wrote ${destination}. Originals were not modified. Skipped ${skipped.length} unreadable files.`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
