# Architecture

```text
apps/
  web/                 SolidJS + Vite, browser-local media workspace
  api/                 Hono, loopback HTTP service
  local-importer/      Read-only filesystem indexer
  mcp/                 Local stdio tools for Codex and Claude
packages/
  db/                  Drizzle schema, PostgreSQL adapter, migrations
  contracts/           Zod external-input schemas and types
  ui/                  Typed visual wrappers around Ark UI
  ui-patterns/         Reusable MediaCard and visual patterns
  design-tokens/       StyleX semantic variables, geometry, light theme
  core/                MediaRepository and typed domain events
  extension-sdk/       Manifest validation and activation contract
  extension-runtime/   Registry, activation, cleanup, events
  storage/             Browser persistence and storage-adapter interfaces
  ai/                  Liara text gateway and retrieval interfaces
extensions/
  adventure-journal/
  media-library/
  ai-memory/
  youtube-publisher/
workers/
  youtube/             Unconfigured Cloudflare publishing boundary
```

## Data boundaries

The web's UI asset model includes local collection membership, memory notes, captions, source URLs, and sample flags. Shared contracts describe backend media records with UUIDs and ISO timestamps. The managed upload workflow maps submitted media metadata into the shared catalog while preserving browser-only memories and drafts.

Web originals are saved in IndexedDB. LocalStorage stores metadata overrides, collections, theme, density, and direction. Temporary object URLs are recreated on startup and revoked on cleanup; blob URLs are not persisted as sources. Metadata export excludes ephemeral source URLs and does not include original media. Clearing browser storage removes local edits and originals from this workspace.

The Hono API accepts JSON media metadata through shared Zod schemas, uses a `MediaRepository`, and emits typed events. `DATABASE_URL` selects the Drizzle/PostgreSQL adapter; otherwise API and MCP share `.data/library.json`. API health discloses persistence mode. The API accepts bounded upload chunks and serves only managed originals under its storage root; it does not serve arbitrary filesystem paths.

MCP hosts independently launch `apps/mcp/dist/stdio.js` using stdio. The server's tools use the same repository and contracts as the API, without requiring an HTTP server to be running. Both services load the root `.env`; `ZCLOUD_DATA_FILE` can select a different absolute catalog path. Concurrent local writes are serialized with a cross-process lock and persisted through atomic replacement. Malformed catalogs fail without resetting existing data. Originals are never copied or modified by the catalog.

The MCP file-indexing tool reads one explicitly selected file's filesystem metadata; its captured timestamp comes from the file's modification time, not EXIF. Legacy browser-only files, notes and drafts remain outside this catalog; managed queue imports register uploaded media and its submitted metadata. See `MCP.md` for tools, registrations, and verification.

## API

| Method | Path            | Result                                          |
| ------ | --------------- | ----------------------------------------------- |
| GET    | `/health`       | Service status and persistence mode             |
| GET    | `/v1/media`     | Media records                                   |
| GET    | `/v1/media/:id` | Media record or 404                             |
| POST   | `/v1/media`     | Validate/create metadata, emit `media.imported` |
| PATCH  | `/v1/media/:id` | Validate/update metadata, emit `media.updated`  |

This is a local single-user service, not an authenticated production deployment. Request bodies are capped at 128 KiB; mutations require JSON. Browser origins are limited to local web development addresses.

## Extensions

Manifests are namespaced and versioned. The registry rejects duplicate IDs, manages enable/disable state, and runs cleanup. Media library is used by the registry example in the UI; the other bundled manifests establish the future extension boundaries. App pages are still core routes, not dynamically contributed extension pages. Capability declaration is not capability enforcement or code isolation.

## Build

pnpm links workspace packages. Turbo orders dependencies. Shared source packages undergo type checking, and their source is compiled by the consuming application. Vite/StyleX run before the Solid transform and extract production CSS from shared UI packages. The API and local importer are bundled with esbuild. Third-party API dependencies remain external.

## Next implementation slices

1. Workspace identity/authentication and database-backed collections/notes.
2. A transactional browser-to-API sync protocol with stable IDs and conflict handling.
3. Import manifest ingestion, thumbnails and file availability tracking.
4. Extension-contributed routes/commands and capability enforcement.
5. Vector retrieval, media AI adapters and durable AI jobs (Liara text generation is connected; see `AI.md`).
6. YouTube OAuth, credential storage, resumable uploads and durable job state in the publishing worker.

## Managed uploads

The API owns a persistent upload queue and encrypted S3 server registry. Browser chunks, SHA-256 receipts, S3 multipart IDs/parts and catalog registration are checkpointed. The web exposes `/imports` and `/servers`; see `UPLOADS.md` for the end-to-end workflow, controls, routes and verification.

Trip and review workflows use `packages/db/src/workspace.ts` to store versioned documents under the configured storage root. This store remains local when the media catalog uses PostgreSQL. `packages/core/src/reviews.ts` defines deterministic missing-field rules; review answers are applied through atomic repository compare-and-update. Trip edits carry optimistic revisions. Leaflet draws only supplied GPX/journal coordinates; planned and recorded tracks remain typed separately. Details: `TRAVEL_WORKFLOWS.md`.
