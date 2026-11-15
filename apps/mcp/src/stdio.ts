import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '@z-cloud/db';
import { createLocalRepository } from '@z-cloud/db/local';
import { createMcpServer } from './server';
import { createWorkspaceStore } from '@z-cloud/db/workspace';
import { dirname } from 'node:path';
import { UploadManager } from '@z-cloud/storage/uploads';
import { ServerRegistry } from '@z-cloud/storage/servers';

const envFile = new URL('../../../.env', import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);
const dataFile =
  process.env.ZCLOUD_DATA_FILE ??
  fileURLToPath(new URL('../../../.data/library.json', import.meta.url));
const database = process.env.DATABASE_URL ? createDatabase(process.env.DATABASE_URL) : undefined;
const repository=database?.repository??createLocalRepository(dataFile);
const storageRoot=process.env.ZCLOUD_STORAGE_ROOT??dirname(dataFile);
const uploads=new UploadManager(storageRoot,repository,new ServerRegistry(storageRoot));
const server = createMcpServer({
  repository,
  mode: database ? 'postgres' : 'local',
  dataFile: database ? undefined : dataFile,
  actor: process.env.ZCLOUD_ACTOR ?? 'mcp',
  toolMode:process.env.ZCLOUD_TOOL_MODE==='assistant'?'assistant':undefined,
  operations:{repository,store:createWorkspaceStore(`${storageRoot}/workspace.json`),chatId:process.env.ZCLOUD_CHAT_ID,transfers:async()=>(await uploads.list()).map(s=>({id:s.id,status:s.status,phase:s.phase,destinationName:s.destinationName,receivedBytes:s.receivedBytes,destinationBytes:s.destinationBytes,metadata:{filename:s.metadata.filename,size:s.metadata.size}}))},
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
