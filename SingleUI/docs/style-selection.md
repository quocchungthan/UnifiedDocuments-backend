# Shared visual foundation: warm French palette, 30s typography and geometry

## Decision

Use the warm column of the user's **French Flat UI palette** reference:
<https://flatuicolors.com/palette/fr> (Flat Flesh, Melon Melody, Squash Blossom,
Iceland Poppy, Carrot Orange, Mandarin Red, Jalapeno Red). This supersedes both
the rejected 30s lime/green colors and the later cold Dutch blue/teal palette.
Keep 30s typography and component geometry, not Farm or PARA themes.

Squash Blossom `#f6b93b` is the action fill with dark ink; text-level accents in
light mode use a derived deep amber (`#9a4a00`) because the swatch itself cannot
reach 4.5:1 on light surfaces. Jalapeno Red carries errors. Warm cream/espresso
surfaces replace neutral canvases. Derived shades are labelled as derivations,
not claims of unchanged palette swatches.

### One place to change colors

`src/design-system/palette.json` is the **only** color source. `npm run palette`
generates `palette.css` (consumed by every app, adapter skin and portable CSS) and
`public/favicon.svg`. `npm run palette -- --check` (part of `npm run test:ui`)
fails when generated files are stale or when any declared foreground/background
pair in `contrast` drops below its threshold. Never hand-edit generated files or
add per-app color overrides.

The geometry/typography source is `web/src/styles.css` at revision
`6881b93107f3ee8178500d075dd56492a0638784`. The branch's frontend matches
the inspected local 30s checkout at that revision. Source and adapted-file
SHA-256 hashes are recorded separately in `src/design-system/source.json`;
`scripts/import-workshop-style.mjs` refreshes that provenance.

The original style used deep green surfaces and pale-lime actions, now replaced
at the user's direction. We retain **DM Sans** body text and **Space Grotesk** display text.
Seven-pixel buttons, rounded glass panels, restrained shadows and small
letter-spaced labels are its component language.

PARA's actual `web/src/ui/para-ui.css` and `web/src/styles.css` were also
inspected at revision `c8bc62f1c709dab5f41681a1bfe9e05c3e174cbe`. Its graphite,
ice-blue, Sora/JetBrains Mono direction is attractive but **not adopted**.
Farm colors and its exact-copy foundation are no longer included.

## Adaptation, not an unchanged copy

The original 30s stylesheet is dark-only and includes a viewport-locked car
layout plus a remote Google Fonts import. Copying it wholesale would break
other business apps and violate system-following appearance.

`workshop-foundation.css` keeps the geometry and supplies one shared warm semantic
palette from `palette.json`: cream light canvas, neutral grey dark canvas (Facebook-style #18191a/#242526), amber actions,
warm keyboard focus, readable neutral ink and distinct control boundaries.
Both system appearances and all derived state colors are adaptations, not
a claim that the original 30s supplied them.

The original font families are embedded locally as variable WOFF2 subsets for
Latin, Latin Extended and Vietnamese where supplied upstream. There are no
runtime remote font requests. `font-sources.json` records upstream URLs/hashes;
`font-licenses.txt` and portable `FONT-LICENSES.txt` retain SIL OFL notices.
`scripts/import-workshop-fonts.mjs` is the explicit refresh tool, not a CI
network dependency. Preserve native icon fonts and user-authored document fonts.

## Shared modules and application boundaries

| Module                                               | Responsibility                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `workshop-foundation.css`                            | Generated warm color roles, system light/dark and 30s geometry.                  |
| `font-faces.css`, `typography.css`                   | Offline original body/display families and shared monospace fallback.            |
| `primitives.css`, `theme.css`                        | Technical compatibility aliases, not a second palette.                           |
| `focus.css`, `controls.css`, `src/ui/components.css` | Reusable focus, buttons, panels, inputs and interaction states.                  |
| `src/adapters`                                       | Map the same roles into native Seafile/AFFiNE and optional old MailBox controls. |

App roots compose their own task layouts. Car rendering remains car-owned;
PARA owns its office renderer; unrelated apps do not load either. Shared i18n
belongs to technical components; business messages stay with their owner.
English/Vietnamese UI follows browser preferences, and appearance follows the OS.
No theme or language selector is introduced.

Mail is an owned Angular app, not a mandatory third-party container. Its proposed
API integration is documented in the repository-level
[API publication plan](../../docs/api-publication-plan.md).
Seafile/AFFiNE remain native integrations; see
[installation and rollback](css-installation.md) for the tested mechanisms.

## Visual acceptance

### Content-first composition

Remove redundant wrappers selectively, not every nested surface. Farm's API
console keeps each endpoint's inner card and removes only the outer panel
(`/api/metadata` and `/api/feeds` only; do not add `/api/portfolio/gigs` to the
API console).
Projects likewise keep their individual cards without an outer card, while
Case Files (`#cases`) uses the shared responsive table (`table.table--stack`)
inside its section panel with investigative/police dossier badges and icons—never
card-in-card `.project.panel` blocks inside `<emfc-panel>`. ProductionCore Aids
service groups likewise use `[flat]="true"` on `<emfc-panel>` so `.target-card`
items are not wrapped in a second bordered panel. Overview
retains its original panel, metric tiles and activity strip; remove only its
redundant description and profile cards. Skills retains its original styling.
The shared Panel's `flat` input retains its heading/region and spacing without
adding a surface when a wrapper is genuinely redundant. Do not add new
palette/radius/shadow tokens to disguise redundant wrappers. Keep meaningful
grouping, strong item titles and avoid repeating header/response content.

### Anti-AI-slop visual and copy discipline

- **No fake status LEDs or decorative dots**: Do not render static `.picker-led`
  or `.status-dot` indicators next to selects or viewport labels when no real
  live connection state is represented.
- **No duplicate `?` text buttons**: Every icon button must use a distinct SVG
  glyph matching its action (e.g., help circle vs. wrench/diagnostic tool).
- **No AI-slop copy tokens**: Avoid two-fragment marketing slogans (`"Long lines.
  Mechanical soul."`, `"Curiosity, with care."`), filler headings (`"A little
  context"`), buzzword verbs (`delve`, `elevate`, `unleash`, `streamline`), and
  microcopy that explains obvious UI or background mechanics. Keep copy grounded
  in each product's domain (e.g., Bobby Singer's `Singer Auto` salvage and
  reference bay for `30s`, and `Elder Vibe Coder` without a `"Farm · "` prefix
  for the main Farm tab title).

Shared code content uses `--emfc-code-surface`: a warm inset surface in light
mode and the darker canvas role in dark mode, distinct from the enclosing card.
IDE-style line numbers are decorative, excluded from copying and assistive
reading, and remain aligned to logical lines when content wraps.
Code soft-wraps by default; an icon-only, labeled toggle retains a no-wrap option.
Copy is also icon-only, with an accessible name, tooltip and live success/error
feedback. Wrapping never changes copied whitespace or URLs.

Metric content starts at the top of its tile. Multiline table cells align to the
top; only column headings stay on one line. Row headings and their descriptions
must wrap so real data cannot enlarge a mobile browser's layout viewport.

Source-selection controls are diagnostics, not product navigation: show them in
development or an explicit `?api=` session. A production fallback must still
identify preview data rather than imply a successful live response. Keep real
errors, local-operation labels and fabricated-data disclosures visible.

When a sidebar moves above content, collapse it to one horizontal, scrollable
row at the same layout breakpoint. Its sticky height must not obscure content
or focused targets, including tablets and landscape phones.

Check actual pages, not only root values. Inspect narrow/wide screenshots in both
themes, shared fonts, spacing, glass hierarchy, readable labels and visible
boundaries. Check default, hover, active/pressed, selected, focus-visible,
disabled, loading and error states, including long translations.

Normal text needs 4.5:1 contrast; meaningful icons, control outlines and focus
need 3:1 against adjacent surfaces. Decorative separators are not control
boundaries. Preserve original product layouts, logos and document colors rather
than forcing identical screens. Local host checks cover selected pinned native
screens, not every upstream screen or production compatibility.
