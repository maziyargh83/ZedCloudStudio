# Z Cloud

Before UI changes, read `docs/design/VISUAL_DIRECTION.md`, `docs/design/DESIGN_SYSTEM.md`, and `docs/design/QUALITY_GATES.md`.

- This is a pnpm + Turborepo monorepo. Work in the existing packages and keep their public exports stable.
- The latest frontend decision is **SolidJS + Vite**, StyleX, Ark UI Solid, TanStack Solid Router/Query, and Lucide Solid. Do not introduce React, Next.js, Tailwind, or another styling framework.
- Component styles belong to StyleX. Global CSS is limited to font registration and reset. Use semantic tokens from `@z-cloud/design-tokens`.
- Use explicit border longhands: the current StyleX compiler drops `border: 0` and general border shorthands. Reset must precede StyleX cascade layers.
- Shared visual primitives live in `packages/ui`; composable media patterns live in `packages/ui-patterns`. Wrap Ark behavior behind these APIs.
- External input contracts live in `packages/contracts`. PATCH schemas must not inherit create-time defaults.
- Web originals and queue state are cached in the browser. The managed import queue sends files and metadata through the API to a selected local/S3 destination and registers shared media. Legacy browser-only files, notes, drafts and demo fixtures are not automatically migrated.
- Read `docs/UPLOADS.md` before upload changes. Preserve chunk/hash validation, stable IDs, S3 multipart checkpoints, original files and credential encryption. Never return saved S3 credentials to a browser or log them.
- API and MCP share a durable catalog: PostgreSQL when configured, otherwise `.data/library.json`. Preserve cross-process locking, atomic replacement, and fail-closed handling of corrupt data.
- MCP runs over stdio: stdout is reserved for protocol messages. Logs go to stderr. Keep its guide explicit that browser IndexedDB is not synchronized. Test actual protocol discovery and independently spawned clients after transport changes.
- Do not seed demo assets or sample collections into the product. Test fixtures belong only under tests. Trip/review documents use the locked, atomic workspace store; keep PATCH defaults stripped and preserve original GPX segments/timestamps. Do not fabricate AI responses, job progress, publications, analytics, or connected accounts.
- The AI workspace uses server-only Liara credentials from the ignored root `.env`. The user's explicit review-question and travelogue actions may send the described text metadata/notes to Liara. Background scans remain local; never send originals automatically. Do not expose credentials or upstream error bodies. Vector retrieval and YouTube integrations remain foundations only. Cloudflare is reserved for YouTube publishing. No FFmpeg/transcoding.
- Extension manifests declare capabilities; they do not provide sandboxing or permission enforcement.
- Run relevant checks: `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:e2e`. Inspect screenshots for major UI work.
- Do not reset user data or overwrite local originals. The importer must remain read-only and skip symlinks.

See `docs/ARCHITECTURE.md` and `docs/IMPLEMENTATION_STATUS.md` for current boundaries.
