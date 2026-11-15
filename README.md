# Z Cloud

A quiet home for your creative world. A local-first creative studio in a pnpm / Turborepo monorepo.

## Start

Requires Node 22.12+ and pnpm 10.20.0. Volta is pinned to Node 22.23.2.

```sh
pnpm install
pnpm dev
```

- Web: http://127.0.0.1:5173
- API: http://127.0.0.1:8787/health
- Component showcase: http://127.0.0.1:5173/dev/ui

The web app uses **SolidJS + Vite**, per the latest frontend decision. Hono serves the API. Shared packages are consumed from TypeScript source; Vite compiles StyleX across package boundaries.

## What works

- Three-panel studio, media grid/list, search, type/tag filters, sort, adjustable density and multiple selection.
- Image, audio and video imports. Files persist in IndexedDB; unsupported playback has a download fallback.
- Favorite assets, create collections, assign assets, edit metadata/tags, write private memories and publication drafts.
- Dark/light themes, RTL layout, command palette, responsive navigation and inspector, accessible dialogs/menus/tabs.
- Studio overview, collection browsing, memories/drafts, real local-library totals, settings, and design-system showcase.
- Validated Hono media endpoints, domain events, PostgreSQL repository, SQL migration, extension registry and lifecycle tests.
- Read-only local file indexer and metadata export.
- Managed import queue with per-file/batch metadata, custom fields, destination selection, pause/resume/retry/cancel, real progress and server-side S3 multipart delivery.
- Storage server list, encrypted credentials, connection checks and bucket selection. Parspack is configured on this installation.

**Current boundary:** files imported through the managed queue are uploaded to the chosen destination and registered in the shared API/MCP catalog. Browser originals remain cached. Existing browser-only files, memories, drafts and demo fixtures are not automatically migrated. Without `DATABASE_URL`, the API and MCP share `.data/library.json`; with it, both use PostgreSQL. AI providers, YouTube publishing and third-party extension isolation remain unconfigured.

Open [the import queue](http://127.0.0.1:5173/imports) or [storage servers](http://127.0.0.1:5173/servers). See [managed uploads](docs/UPLOADS.md) for persistence, controls and current boundaries.

## MCP for Codex and Claude

```sh
pnpm mcp:build
pnpm mcp
```

The stdio server is `apps/mcp/dist/stdio.js`. Hosts launch it on demand; the web/API servers do not need to be running. It exposes 8 tools: `zcloud_context`, `media_list`, `media_get`, `media_register`, `media_index_file`, `media_update`, `library_stats`, and `extensions_list`, plus `zcloud://guide`.

It is registered as `zcloud` in this machine's Codex, Claude Code user configuration, and Claude Desktop. New host sessions load the connection; Claude Desktop needs a restart to load its changed configuration. See [MCP setup and verification](docs/MCP.md).

## Optional PostgreSQL

```sh
docker compose up -d postgres
cp .env.example .env
pnpm db:migrate
pnpm dev
```

The API and Drizzle config load the root `.env`. Local demo credentials are in `compose.yaml`. The API binds to loopback and is a single-user development service, without account authentication.

## Index an existing folder

```sh
pnpm import:local /absolute/path/to/media /absolute/path/to/new-manifest.json
```

The indexer scans supported files, skips hidden paths and symlinks, and writes a JSON manifest. It never edits originals and refuses to overwrite an existing manifest. It does not upload media or automatically import the manifest into the web UI yet.

## Checks

```sh
pnpm typecheck
pnpm build
pnpm test
pnpm test:e2e
```

Browser checks use the installed Chrome channel. In an environment without Chrome, install Chrome or change the Playwright `channel` setting and run `pnpm --filter @z-cloud/web exec playwright install chromium`.

Shared libraries are source packages, so their build tasks validate types; web, API, and importer emit runnable bundles into their own `dist` directories. `pnpm --filter @z-cloud/api start` runs the built API.

See [architecture](docs/ARCHITECTURE.md), [implementation status](docs/IMPLEMENTATION_STATUS.md), [MCP integration](docs/MCP.md), and [asset credits](docs/ASSET_CREDITS.md).
