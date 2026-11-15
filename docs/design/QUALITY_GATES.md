# Quality gates

Before completing a major UI change:

1. Run strict type checks and production build across the monorepo.
2. Run API validation/event tests and extension lifecycle tests when those boundaries change.
3. Run browser interaction tests for search, filters, selection and view modes.
4. Verify metadata, tags, memory notes, drafts and real imported blobs survive a reload.
5. Verify theme persistence, RTL layout, command palette, focus trapping and Escape behavior.
6. Check 390, 768, 1024, 1440 and 1920 px widths for overflow. Inspect actual screenshots; do not rely only on programmatic assertions.
7. Check dark/light contrast and visible focus. Run axe against the library and open showcase dialog.
8. Check empty, unavailable-storage, unsupported-playback and long-content states.
9. Verify local images/fonts load without remote CDN dependencies or console errors.
10. Confirm every enabled action does real work. Label samples and unconfigured integrations.

Commands: `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:e2e`.

Browser screenshots are saved to `docs/screenshots/`. Keep the implementation status honest: an executable migration is not evidence that a live database migration was applied; a manifest is not a sandbox; a local draft is not a successful publication.
