# Initial studio milestone — 2026-11-15

MCP follow-up: `apps/mcp` adds the 19th workspace package, 8 tools and a guide resource. Codex, Claude Code and Claude Desktop are configured. API/MCP now share a persistent local catalog by default; the initial verification table below records the earlier studio baseline. Current MCP details and verification are in `MCP.md`.

Managed-import follow-up: the new `/imports` and `/servers` screens support per-file/batch metadata, custom fields, persistent chunked uploads and real S3 multipart delivery. The supplied Parspack destination and discovered bucket were configured and verified with a temporary round-trip test. See `UPLOADS.md`; the initial baseline limitations below are historical where superseded.

## Delivered

The requested pnpm/Turborepo structure is running in the existing `zedCloud` folder, with 18 workspace packages plus the root. The web uses SolidJS/Vite rather than the older Next.js architecture. The frontend is TypeScript strict, StyleX, Ark UI Solid, TanStack Solid Router/Query and Lucide Solid.

Working screens: media library, favorites, recent imports, individual collections, studio overview, adventure collections, private memories, local publication drafts, library totals, settings, extension registry example, and `/dev/ui`. AI and remote publishing have honest unconfigured states.

The library includes local photography, grid/list views, search, media type and tag filtering, date/name sorting, adjustable density, multi-selection, favorite toggling and preview. The inspector edits title/description/location/tags, collection membership, memories and captions. Metadata and real imported files survive a reload.

Shared packages contain semantic dark/light tokens, typed visual primitives, Ark-backed overlays/navigation, an app-independent MediaCard, browser persistence, Zod contracts, domain events, storage/gateway interfaces, a Drizzle repository and migration, extension manifests/registry/lifecycle, a read-only local indexer, and a clearly unconfigured YouTube worker.

## Verification

| Check                     | Result                                                                       |
| ------------------------- | ---------------------------------------------------------------------------- |
| `pnpm install`            | Workspace links and lockfile created                                         |
| `pnpm typecheck`          | All 18 packages passed                                                       |
| `pnpm build`              | All 18 tasks passed; web/API/importer bundles emitted                        |
| `pnpm test`               | 4 API/extension tests passed                                                 |
| `pnpm test:e2e`           | 7 browser tests passed in installed Chrome                                   |
| Production web smoke      | 12 assets, extracted shared StyleX CSS, local images/font, no runtime errors |
| Production API smoke      | Built server started and returned healthy temporary-memory mode              |
| Production importer smoke | Indexed supported file, skipped symlink/unsupported file, refused overwrite  |
| Shared StyleX HMR         | Token changed, browser color updated, source restored                        |
| Drizzle generation        | SQL migration generated successfully                                         |
| Live PostgreSQL migration | Not run: Docker daemon is not running                                        |

Browser tests cover metadata/tag/note/draft persistence; original blob persistence; filtering and multi-selection; collection creation; command palette; dark/light persistence; mobile inspector; RTL overflow; dialog focus trap/Escape; and axe WCAG A/AA checks for the library and open dialog. No violations were reported on these tested surfaces. This is not a comprehensive accessibility certification of every route and state.

Screenshots were captured and inspected at 1440×900, 1024×768, 390×844, and additional 768/1024/1920 widths. Light desktop and RTL mobile screenshots are included. The visual passes corrected dropped StyleX border shorthands, reset layer precedence, a hidden sidebar that moved into the RTL viewport, portal theming, and light-theme count contrast.

Useful captures:

- `screenshots/production-1440.png`
- `screenshots/library-1024x768.png`
- `screenshots/library-390.png`
- `screenshots/library-light-1440.png`
- `screenshots/library-rtl-390.png`

The production web output is approximately 489 KB JavaScript / 154 KB gzip and 19.6 KB CSS / 5.2 KB gzip. Vite reports harmless upstream Zod comment-annotation warnings; the build succeeds.

## Boundaries and next work

- Legacy browser-only media/notes/drafts remain local. Managed queue imports now register uploaded originals and metadata in the shared catalog.
- The API has a PostgreSQL adapter and now defaults to the persistent local catalog shared with MCP. It is bound to loopback and has no multi-user authentication.
- The schema currently covers backend media metadata. Database-backed collections, notes, publication jobs and workspace identity are next slices.
- The file indexer writes manifests; manifest ingestion and filesystem availability tracking are not integrated into the UI.
- Extension manifests and lifecycle work, but app routes remain core routes. Dynamic contribution slots, capability enforcement and third-party isolation are future work.
- AI gateway/retrieval contracts are present; no provider or vector backend is integrated.
- YouTube OAuth, resumable uploads, scheduling, durable job state and publishing are not implemented. The worker returns an unconfigured response and has not been deployed.
- Localization is not complete. The shell is English with RTL layout support. Mobile control target sizes and a broader component inventory should be refined in later milestones.

The next useful end-to-end implementation is database-backed workspace/media identity followed by a browser/API sync protocol. This enables durable collections and notes without silently replacing local originals.
