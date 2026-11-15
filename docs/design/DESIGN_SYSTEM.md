# Design system

## Foundation

Authored component styles use StyleX exclusively. `colors.stylex.ts` declares semantic `defineVars`; the light theme uses `createTheme`; static geometry and timing values use `defineConsts`. Feature code imports semantic tokens, never raw theme colors.

| Role              | Dark    | Light   |
| ----------------- | ------- | ------- |
| Canvas            | #111315 | #F5F5F2 |
| Sidebar           | #15181A | #F0F1ED |
| Surface           | #1C1F22 | #FFFFFF |
| Alternate surface | #25292D | #EAEBE7 |
| Primary text      | #ECEEEA | #1B201F |
| Secondary text    | #ABB2AF | #4D5753 |
| Muted text        | #87918D | #626D67 |
| Accent            | #D6A45B | #805416 |
| Accent surface    | #393022 | #F3E7D3 |

Use secondary text on accent surfaces; dark muted text on the accent surface falls below the required 4.5:1 contrast.

Inter is bundled locally with system fallbacks. UI sizes range from 9–14 px for compact labels/metadata and 17–28 px for headings. Editorial overview headings use 36 px. Fixed small uppercase labels use letter spacing; long names wrap or truncate in their allocated space. Use tabular numbers for counts and storage sizes.

Base spacing increments are 4, 8, 12, 16, 20, 24 and 32 px. Control radii are 6–8 px; panels use 8–12 px. Control heights are 28, 34, 40 px. The initial shell uses a 232 px sidebar, 280–304 px inspector, 56 px toolbar and 28 px status bar. These adapt by viewport size.

Use 120–180 ms transitions for state changes. Respect reduced motion. Prefer borders and color changes to shadows and movement.

## Public components

| Component            | API / behavior                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Button               | `primary`, `secondary`, `ghost`, `danger`; `sm`, `md`, `lg`; native disabled/type/event props                    |
| IconButton           | Required accessible `label`, optional active state; 32 px control                                                |
| Badge                | `neutral`, `accent`, `success`, `info`                                                                           |
| TextField / Textarea | Native typed props; semantic focus and disabled behavior                                                         |
| Surface              | Neutral bordered panel                                                                                           |
| Dialog               | Controlled `open`, `onOpenChange`, title/description; optional wide viewer; Ark focus trap, Escape and dismissal |
| Tabs                 | Controlled value, typed item labels, change callback and associated content; Ark arrow-key navigation            |
| Dropdown             | Labeled trigger and items; Ark keyboard navigation and focus management                                          |
| Tooltip              | Ark delayed tooltip behavior                                                                                     |
| EmptyState           | Icon, title, description, optional real action                                                                   |
| MediaCard            | Shared pattern with controlled selection, preview and favorite callbacks; no application store dependency        |

These are the initial components, not a complete mature component library. Loading, errors, empty content and unsupported media are handled in feature composition. Showcase route: `/dev/ui`.

## Compilation constraints

- StyleX must transform before Solid.
- Cascade layers must place reset before generated styles.
- Use explicit border width/style/color properties. General `border` shorthands are dropped by the installed compiler.
- Keep semantic variable modules named `*.stylex.ts`.
- Themes are applied to the root document as well as the app to cover portal content.
- Test the production CSS, shared package imports and development HMR after configuration changes.

## Accessibility

Use native controls for simple behavior and Ark for composite interactions. Keep named controls, visible focus, associated labels, dialog focus return, persistent text contrast and honest disabled states. Honor logical inline properties for RTL. Avoid nesting buttons or links inside buttons. The default shell is compact desktop UI; continue improving touch targets in future mobile refinements.
