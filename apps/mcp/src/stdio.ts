import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '@z-cloud/db';
import { createLocalRepository } from '@z-cloud/db/local';
import { createMcpServer } from './server';

const envFile = new URL('../../../.env', import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);
const dataFile =
  process.env.ZCLOUD_DATA_FILE ??
  fileURLToPath(new URL('../../../.data/library.json', import.meta.url));
const database = process.env.DATABASE_URL ? createDatabase(process.env.DATABASE_URL) : undefined;
const server = createMcpServer({
  repository: database?.repository ?? createLocalRepository(dataFile),
  mode: database ? 'postgres' : 'local',
  dataFile: database ? undefined : dataFile,
  actor: process.env.ZCLOUD_ACTOR ?? 'mcp',
});
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await server.close();
  await database?.close();
}
process.stdin.on('end', () => {
  void close();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void close().then(() => process.exit(0));
  });
await server.connect(new StdioServerTransport());
