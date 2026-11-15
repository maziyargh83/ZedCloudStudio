# Review inbox and adventure wiki

The product starts with no example media, trips or collections. The twelve bundled sample photos and featured sample collection have been removed. On browser hydration, legacy demo metadata is removed and real browser originals remain. The API removes only catalog records explicitly marked `source: demo`; it never deletes originals or S3 objects.

## Metadata review

Open `/reviews` to scan registered media. The rules flag filename-like titles, empty descriptions/tags/locations and the need to confirm capture timestamps. A file timestamp is not treated as proof of when the moment happened. Upload-queue entries become eligible after registration. Browser-only legacy originals must be uploaded or registered first.

Questions work without AI. “Ask Liara” explicitly sends the selected item's filename, type and text metadata to personalize the questions; it never sends originals, storage credentials or source paths. Partial AI output is completed with guided questions and labeled as mixed; invalid/provider-failed output leaves the rule-based questionnaire available. Answers are saved as a durable draft, shown alongside current values, and applied only through “Apply reviewed changes.” Unknown fields can be explicitly skipped without inventing a value. Changes elsewhere invalidate stale review revisions; the repository compares the original values atomically before applying.

Reviews can be deferred and reopened. Imported files and their upload sidecars are unchanged by catalog metadata review; the shared API/MCP catalog receives the reviewed values. Browser library metadata refreshes from that catalog. Original file EXIF is not modified or extracted.

## Trip workspace

`/adventures` holds trip wikis. Each trip has a destination, dates, status, overview, explicitly linked media, dated journal entries, challenges, lessons, plans/checklists, packing list, track recordings, planned routes and an optional AI travelogue draft. Logs and gear can be edited. Plan and challenge checkboxes track completion/resolution. Gear weight is the entered per-item weight times quantity; an unknown weight is zero and is not estimated.

`/planner` lists trips with planning status. The recall inbox derives prompts from up to the first 31 trip dates plus recorded GPX dates, showing up to 14 past/current days without a journal entry. It also prompts for challenges, equipment notes and unlinked photos. These are in-app questions, not scheduled notifications. No biography, event, equipment use or location is fabricated.

Linking photos is explicit. Date matches are suggestions and do not automatically assign a photo to a trip. The wiki's media section opens actual library thumbnails. “Export wiki” produces Markdown containing real notes, gear, track summaries, media IDs and any labeled AI draft. Original media is not embedded into an offline archive.

“Generate travelogue” sends saved overview/log/gear text to Liara. Coordinates and media originals are excluded. It requires at least one non-plan log. The draft is rendered as plain text and labeled as AI; a later trip edit marks it outdated. Requests over the context limit are rejected instead of silently dropping notes. Generation is revision checked, so notes edited during a request are not overwritten by stale output. The model can still make mistakes: the editable source notes and exported wiki remain the factual record.

## Maps and GPX

The trip map and `/map` atlas draw entered coordinates and imported GPX points using Leaflet. GPX input is parsed locally before normalized coordinates are saved. Up to 20,000 points per import/track are accepted. Track segments, elevation and valid timestamps are preserved; malformed XML, DTD/entity declarations and invalid coordinates/times are rejected. GPX route/waypoint elements are supported. The import type is explicitly chosen as recorded or planned.

Date filters use UTC point dates and split lines at excluded points and original segment boundaries; they do not join gaps into invented traveled paths. Undated points have an explicit visibility toggle. The atlas hides plans by default. Solid lines mean imported recordings; dashed lines mean plans. Journal coordinates are distinct from GPX tracks. No location is inferred from a place name, photo, or absent EXIF.

Draw a plan by clicking the map or entering waypoints, undo the last point, save it, and export GPX. Planned lines connect entered points directly; there is no road/trail routing, elevation lookup, travel-time calculation or navigation engine. Distances are spherical straight distances between consecutive points in each segment, not routed road distances. GPX export preserves recorded segments/timestamps and labels planned routes. The original GPX file is not automatically archived.

Basemap tiles come from OpenStreetMap with visible attribution and normal browser caching. Only visible map tiles load; there is no bulk/offline prefetch. Coordinates and tracks still render when tiles fail, with an unavailable-basemap message. `VITE_MAP_TILE_URL` can select another compatible tile service; update attribution in the map component when changing providers. See the [Leaflet guide](https://leafletjs.com/examples/quick-start/) and [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

## Persistence and boundaries

Trip/review documents live in `${ZCLOUD_STORAGE_ROOT}/workspace.json` (default `.data/workspace.json`), even when the media catalog uses PostgreSQL. They use a versioned schema, cross-process lock, atomic replacement and owner-only permissions. Corrupt workspace data fails closed. Include this file, the catalog and originals in backups; secrets remain separate. Keep one API instance for this local installation. Trip edits require the latest revision rather than silently overwriting another open editor. A conflicting edit leaves the form available; refresh before retrying.

Automated tests use an isolated catalog/workspace and test-only media fixtures; they never seed sample trips into the user's workspace or invoke paid AI generation. Live provider checks, when run, use explicitly selected non-sensitive test text.

## Next ideas

These are planned ideas, not connected capabilities: reusable kit templates and per-trip equipment lessons; geotag/EXIF suggestions with consent; an offline trip bundle with originals; map matching and vetted trail routing; expense/budget tracking; consented scheduled recall reminders; and a trip comparison showing lessons carried into the next plan. The implemented starting points are the packing weight/readiness view, date-gap recall inbox, cross-trip atlas, explicit media date-match suggestions and stale-draft detection.

## Verification on this installation

- Type checks and production build passed for all 19 workspace packages.
- 20 backend/package tests and 14 browser tests passed; the two new end-to-end workflow tests passed again after final UI changes.
- Tested draft persistence, explicit metadata application, stale edits, unchanged PATCH fields, journal/gear persistence, date-filtered segments, GPX/Markdown downloads, 390–1920 px layouts and accessibility.
- The actual uploaded original still serves its original 4,522,297-byte content. No sample trip was added to the real workspace.
- Live Liara question generation returned validated questions with labeled guided fallbacks; live OpenStreetMap tiles loaded in the built atlas.
