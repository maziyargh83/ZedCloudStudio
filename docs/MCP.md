# Z Cloud MCP

Z Cloud is registered as `zcloud` in Codex, Claude Code (user scope), and Claude Desktop on this machine. Hosts launch the server on demand using stdio. No separate server command or web window is required for MCP tools.

## Installed connection

- Runtime: `/Users/maziyar.gholami/.nvm/versions/node/v24.15.0/bin/node`, matching the local Gaam runtime.
- Entrypoint: `/Users/maziyar.gholami/development/zedCloud/apps/mcp/dist/stdio.js`.
- Codex config: `~/.codex/config.toml`.
- Claude Code config: `~/.claude.json`, user-level `mcpServers.zcloud`.
- Claude Desktop config: `~/Library/Application Support/Claude/claude_desktop_config.json`.
- Host actor: `ZCLOUD_ACTOR=codex`, `claude-code`, or `claude-desktop`.

Existing connections, including Gaam, were preserved. Configuration backups were saved beside each original with a `.before-zcloud-...` suffix. They can contain other existing configuration values; keep them private.

After a source change, rebuild with `pnpm mcp:build`. New Codex/Claude Code sessions load the configured connection; restart Claude Desktop to load its changed configuration. The active Codex chat does not gain tools merely because a config file was written, so use a new chat if they are not listed yet. No app was force-quit during installation.

## Tools

| Tool               | Behavior                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `zcloud_context`   | Storage mode, true record count, actor and integration boundaries                                  |
| `media_list`       | Bounded search, type/tag/favorite filters and pagination; Persian ی/ک normalization                |
| `media_get`        | Read one catalog record by UUID                                                                    |
| `media_register`   | Register supplied metadata, without uploading or verifying an original                             |
| `media_index_file` | Index one local file's path, size, MIME and modification time; skip symlinks and unsupported types |
| `media_update`     | Edit title, description, tags or favorite while preserving unspecified fields                      |
| `library_stats`    | Actual record/type/favorite/metadata-byte totals                                                   |
| `extensions_list`  | Declared bundled extension manifests and capabilities                                              |

Resource: `zcloud://guide` describes behavior and limits. Read-only tools and mutating tools have distinct MCP annotations. Errors never silently reset the local catalog. stdout contains MCP protocol messages only.

## Shared data

By default, API and MCP read and write `<repository>/.data/library.json`, independently of the current working directory. The file is created on the first mutation and is excluded from version control. Local mutations acquire a cross-process lock, read the latest validated state, and write through atomic replacement. Separate Codex and Claude processes see the same data.

`ZCLOUD_DATA_FILE` overrides this location; use an absolute path. With `DATABASE_URL`, both services use the existing Drizzle/PostgreSQL adapter instead. Both load the root `.env` without copying database credentials into host configs.

Files sent through the new managed import queue upload their originals and metadata through the API to a selected local/S3 destination, then appear in the shared catalog. Existing browser-only media, memories, drafts and demo fixtures remain separate and are not automatically migrated. Metadata-only MCP indexing still does not copy, upload, transcode or publish an original. See `UPLOADS.md`. Indexing uses filesystem modification time rather than claiming extracted capture metadata. Liara text generation is available through the web/API workspace; MCP tools do not generate AI responses. YouTube remains unconfigured. See `AI.md`.

## Verification on 2026-11-15

- Strict typecheck and build passed across all 19 workspace packages.
- MCP protocol tests passed: initialization, discovery of 8 tools, guide resource, CRUD, search, stats, invalid patches, file indexing, and persistence across client reconnection.
- Two independently spawned stdio clients shared the same catalog and observed each other's edits.
- A built API and MCP process passed a bidirectional shared-catalog check: an API-created record was read over MCP, then an MCP edit was read back through HTTP. The test used a temporary catalog and did not add records to the user's library.
- Local repository tests passed: concurrent writers preserved 12 records; corrupt input failed without overwriting existing data.
- Host configurations were read back and their exact configured runtime, arguments and actor were used for a real MCP initialization and `zcloud_context` call.
- `claude mcp get zcloud` reported `Connected`. `codex mcp get zcloud --json` reported enabled stdio configuration.

Useful commands:

```sh
pnpm mcp:build
pnpm --filter @z-cloud/mcp test
pnpm --filter @z-cloud/db test
codex mcp get zcloud --json
claude mcp get zcloud
```

Configuration follows [OpenAI's MCP documentation](https://developers.openai.com/codex/mcp/) and [Claude Code's MCP documentation](https://code.claude.com/docs/en/mcp). The transport uses the same maintained MCP SDK v1 line as the existing Gaam installation.
