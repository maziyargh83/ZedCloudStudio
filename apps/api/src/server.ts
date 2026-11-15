import { serve } from '@hono/node-server';
import { createDatabase } from '@z-cloud/db';
import { createLocalRepository } from '@z-cloud/db/local';
import { createWorkspaceStore } from '@z-cloud/db/workspace';
import { UploadManager } from '@z-cloud/storage/uploads';
import { ServerRegistry } from '@z-cloud/storage/servers';
import { EventBus } from '@z-cloud/core';
import { LiaraGateway } from '@z-cloud/ai';
import { dirname } from 'node:path';
import { createApp } from './app';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { createAssistantRoutes } from './assistant';
const envFile = new URL('../../../.env', import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);
const database = process.env.DATABASE_URL ? createDatabase(process.env.DATABASE_URL) : undefined;
const localPath =
  process.env.ZCLOUD_DATA_FILE ??
  fileURLToPath(new URL('../../../.data/library.json', import.meta.url));
const repository = database?.repository ?? createLocalRepository(localPath);
await repository.removeDemos();
const dataRoot = process.env.ZCLOUD_STORAGE_ROOT ?? dirname(localPath);
const servers = new ServerRegistry(dataRoot);
const uploads = new UploadManager(dataRoot, repository, servers);
await uploads.recover();
let ai;
if (process.env.LIARA_API_KEY && process.env.LIARA_BASE_URL) {
  try {
    const gateway = new LiaraGateway({
      apiKey: process.env.LIARA_API_KEY,
      baseURL: process.env.LIARA_BASE_URL,
      model: process.env.LIARA_MODEL,
    });
    ai = { gateway, model: gateway.model };
  } catch {
    console.error('Liara configuration is invalid; AI is unavailable.');
  }
}
const workspace=createWorkspaceStore(`${dataRoot}/workspace.json`);
const app = createApp(
  repository,
  database ? 'postgres' : 'local',
  new EventBus(),
  uploads,
  process.env.ZCLOUD_WEB_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  ai,
  workspace,
  createAssistantRoutes({store:workspace,repository,uploads,ai,storageRoot:dataRoot,dataFile:localPath}),
);
const server = serve(
  { fetch: app.fetch, hostname: '127.0.0.1', port: Number(process.env.PORT ?? 4877) },
  (info) =>
    console.log(
      `Z Cloud API: http://127.0.0.1:${info.port} (${database ? 'PostgreSQL' : 'persistent local catalog'})`,
    ),
);
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    server.close(async () => {
      await uploads.close();
      await database?.close();
      process.exit(0);
    });
  });
