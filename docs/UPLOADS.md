# Managed media imports

## Using the workflow

1. Open **Import media** and choose/drop one or more photos, videos or audio files.
2. Select a file to edit its title, description, capture date, location, tags, collection and custom key/value fields. **Apply shared details to all files** copies shared fields while keeping each file's name, type, size and title individual.
3. Choose a destination from **Storage servers**. The supplied **Parspack** connection is registered with its discovered bucket `c353963`. **This server** is also available as local managed storage.
4. Add files to the queue. Uncheck automatic start to review a paused batch first.
5. Open `/imports` to see status, transferred bytes, progress, destination and errors. Pause/resume one or all, retry failed files, edit early paused metadata, or cancel a transfer. Completed originals remain in the media library.

`/servers` lists destinations, tests connections, loads available S3 buckets, and adds/edits profiles. Saved keys are not returned by the API or prefilled in the browser. Connection routing cannot change underneath unfinished transfers; credentials can still be rotated to fix a failed connection.

## What persists

- Browser originals and transfer records are saved together in IndexedDB. The upgrade preserves existing local files. Closing the page does not discard the queue.
- The browser sends chunks of at most 8 MiB, with at most two active transfers. A resumed client asks which chunks are already saved and verifies their SHA-256 hashes before skipping them. A reselected original must match the saved data.
- The API stores locked, atomically replaced upload manifests and chunk receipts in `.data/uploads/<id>/`. Duplicate chunks are accepted only if their hashes match. A conflicting file/destination cannot reuse the same upload ID.
- After all chunks arrive, a durable server queue verifies and assembles the original. At this point delivery can continue without the browser. The server restarts unfinished processing on startup; deliberately paused or failed jobs remain paused or require retry.
- S3 multipart upload IDs, acknowledged parts and ETags are persisted. Pause/retry continues acknowledged parts. Metadata registration and the sidecar are checkpointed, so retrying a metadata failure does not upload the original again.
- The API writes the media record using a stable ID, shared with MCP. Repeated completion cannot create duplicate catalog entries.
- An S3 original is stored under `zcloud/media/<upload-id>/<safe-filename>` with `<key>.metadata.json` containing the submitted metadata and content hash. Object keys are unique; original user files are never overwritten.
- Cancellation aborts unfinished S3 multipart uploads and cleans that job's staging files. Browser originals are retained. Once an S3 object is committed, finish registration rather than treating it as an unuploaded cancellation.

The progress UI represents received browser bytes plus acknowledged destination bytes; it does not invent time-based progress. The server transfer list is also visible when a session's browser-local history is absent.

## Storage and credentials

The API stores server profiles in `.data/servers.private.json`, with AES-256-GCM encrypted credentials. The encryption key is a separate `.data/servers.key` file, created with owner-only permissions. Both live in the ignored data directory and are never bundled into the web app. Back up the data directory and key together when moving this local installation.

The local default storage root is the catalog file's parent directory; `ZCLOUD_STORAGE_ROOT` can override it. Managed originals remain cached in `.data/originals/<asset-id>` for preview/download, including HTTP range support. Existing browser-only files, notes, memories and drafts are not automatically migrated. New queued uploads and their catalog metadata are shared with the API/MCP; collection names and custom data are stored as media metadata rather than a new full collection database.

The API remains the local single-user service. The added S3 destination is remote object storage; this work does not deploy the API itself to Parspack or enable YouTube publishing.

## Validation

The final checks passed: strict types/build across 19 packages, 13 internal API/storage/MCP/extension tests, and all 10 browser tests. Production server/editor views were also inspected, including a saved-key exposure check and live destination selection.

- Storage tests verify chunk duplication/conflict handling, pause/resume across a new manager, identical saved bytes, stable registration IDs, encrypted credentials and S3 retry checkpoints.
- HTTP tests verify bounded uploads, real original bytes, metadata, range responses, cancellation, safe credential rotation and protected destination changes.
- Browser tests verify batch metadata/custom fields, durable paused queues, real upload completion, retry, cancellation, server settings, mobile overflow and queue accessibility.
- A real temporary PNG was uploaded through the multipart pipeline to Parspack, downloaded and byte-compared; its metadata sidecar was checked. Both temporary objects were removed afterwards.
- PostgreSQL has an additional generated migration for media metadata/destination fields. Apply migrations before using the PostgreSQL adapter; the live cloud transfer check used the local catalog.

## API endpoints

| Method      | Path                            | Behavior                                                      |
| ----------- | ------------------------------- | ------------------------------------------------------------- |
| GET / POST  | `/v1/servers`                   | List public profiles / add an S3 destination                  |
| PATCH       | `/v1/servers/:id`               | Edit settings or rotate credentials                           |
| POST        | `/v1/servers/:id/test`          | Test bucket/account access                                    |
| GET         | `/v1/servers/:id/buckets`       | List accessible bucket names                                  |
| GET / POST  | `/v1/uploads`                   | List server transfers / initialize an idempotent upload       |
| GET / PATCH | `/v1/uploads/:id`               | Read progress / pause, resume, cancel, or edit early metadata |
| PUT         | `/v1/uploads/:id/chunks/:index` | Save one bounded, hash-checked chunk                          |
| POST        | `/v1/uploads/:id/complete`      | Queue destination delivery and registration                   |
| GET         | `/v1/media/:id/content`         | Stream a managed cached original with range support           |
