# EMFc and SingleUI instructions

## Purpose and principles

EMFc means **Encapsulated, Managed, Functional, contract-first**. Its purpose is to
make development and AI-agent work focused, accurate, and economical in time and
tokens through concrete, controlled, composable blocks.

- Encapsulated: each module has a bounded responsibility and hides implementation
  details behind an explicit public interface.
- Managed: configuration, dependencies, supported behaviour, and build/release
  paths are controlled and understandable.
- Functional: each block performs a specific useful job. Avoid filler modules,
  speculative abstractions, and miscellaneous shared-code buckets.
- Contract-first: define inputs, outputs, errors, and integration boundaries
  before implementing or changing a capability.

Keep modules independently understandable, maintainable, reusable, and pluggable.
Do not confuse "Functional" with a requirement to use a functional-programming
language or style.

## Workspace and application boundaries

`SingleUI` is the shared Angular/npm workspace and framework, not a single
domain application's folder.

- Keep separate application folders directly under `SingleUI\src`, following
  the first app's layout: `SingleUI\src\app-car-3d-models`.
- Do not nest another project/source tree such as
  `src\car-3d-model\src`. Keep framework entry points, global styles, static
  assets, and workspace configuration outside application folders.
- Applications own domain-specific screens, presentation composition, and
  transient view state. They consume capabilities through public interfaces.
- Keep design-system modules, contracts, domain models, validation and
  transformations, and API clients outside application folders.
- Organize contracts, models and API clients by bounded capability/domain. Moving a car model
  outside its app does not make it a shared chess model. Do not force unrelated
  domains into one universal model or API client.
- Organize shared presentation by technical component, not business app/domain:
  buttons, panels, navigation, tables and their states consume one shared theme.
  Apps compose these components into their original business layouts. Do not
  create separate first-party product themes or copy app-specific layout styles
  into the shared design system. A single explicitly selected shared foundation
  may be imported with recorded source provenance.
- Common UI messages belong to their reusable component/capability, using typed
  locale catalogs and one locale service. Business-specific copy remains with
  its owning capability/app; do not mix all apps into a fallback string dictionary.
- Car-specific Three.js rendering, geometry, camera wiring and workshop workflows
  belong within app-car-3d-models, not a generic shared renderer. PARA's original
  3D office independently needs Three.js through its own renderer. Verify other
  app bundle graphs exclude car code/assets and unused 3D dependencies.
- API clients own endpoint calls, transport concerns, authentication integration,
  and explicit error handling. Do not scatter direct endpoint calls across views.
- Shared/domain modules must not import application internals. Keep domain
  contracts and models independent of presentation and transport implementations.
- Define module interfaces and dependency direction first; choose the smallest
  structure needed for actual capabilities. Do not create empty scaffolding just
  to fill an architecture diagram.

## App selection and current revision

The first app is a universal UI for 3D models of cars. Angular demo restoration
is authorized for Farm, 30s/Car 3D Models, PARA Bridge, and ProductionCore Aids,
preserving original business UX while adopting shared technical components. Keep app roots small:
compose focused capabilities instead of accumulating workflows in app.ts.
`SingleUI/apps.json` is the canonical ID list:
car-3d-models, car-knowledge, farm, lingobridge, chinese-chess-lovers, para-ai, disklens,
productioncore-aids, exploring-local, mail, identity.
`30s` aliases `car-3d-models`; `para-ui` aliases `para-ai`. Do not duplicate them.
Car Knowledge owns the car definition graph, photograph explanations, transcript
submission and imported-assembly view. Keep these screens out of PARA's
orchestration dashboard; their backend remains PARA-AI-solution.

Run commands from `SingleUI`:

```text
npm ci
npm start -- --app=car-3d-models
npm run build -- --app=car-3d-models
npm test -- --app=car-3d-models --watch=false
npm run test:launcher
npm run build:apps
```

`scripts\app.mjs` is the shared launcher for start/build/watch/test. The same
`--app` flag selects the app for these commands, defaulting to `car-3d-models`.
Reject unknown, missing, or duplicate app values explicitly; forward other
Angular options. Selection belongs in the surrounding framework, not app code.

The flag selects a static Angular file replacement in the shared `single-ui`
project. `src\main.ts` imports `src\selected-app.ts`; configurations replace that
module with the selected `src\app-<id>\app.ts`. Output is isolated under
`dist\app-<id>\browser`. Production/development mode is combined with app
selection; do not allow raw Angular overrides to bypass it. There is no runtime
app switch, registry UI or portal. Every registered app now clones its original
screens on shared `src\api` clients and the shared kit (`src\ui`: lucide icons,
metrics, tables, CountChart, Markdown, underlined Tabs, `emfcSkipLink`). Issue #1 substitution contract:
`?api=auto|live|substitute&scenario=default|signed-out|empty|failure|loading`.
Auto falls back to labeled substitutes only for reads on `ServiceUnavailableError`;
commands never fall back and substitutes never fabricate third-party/tool results.
Use substitute scenarios to visually check every state. With `<base href="/">`,
use `emfcSkipLink` instead of plain `#id` links. Never present local operations as server work.
Full original feature parity and real-backend integration are not established.
Identity (Fences) has a standalone GitHub login, service hub, account details,
owner audience and read-only repository UI with explicit substitutes. Its verified
API client targets identity.eldervibe.dev; live OAuth/CORS integration is not proven.
Mail now has an Angular inbox/message/compose UI. Its proposed `/api/mail/*`
contract is not implemented by the inspected original SSR backend; fixture
journeys are not live mail verification. Track backend publication in the
repository-level `docs/api-publication-plan.md`, outside SingleUI.
The reusable `ui\entry-page` and its presentation contract/catalogs live outside
apps. Keep this description accurate as domain screens are implemented.

### Standalone entry and automatic system preferences

Launching a selected app must show only that app's product experience, not a
workspace portal. Do not add a shared sidebar, app switcher, SingleUI/framework
branding, foundation demo, or workspace terminology to the selected app's UI.
Shared implementation belongs outside apps but must not leak into product UX.

Appearance follows the system automatically through `prefers-color-scheme`,
including live changes. Do not expose appearance selectors or persist overrides
in first-party apps. Translation/i18n likewise follows browser/system language
preferences automatically, without a language picker. Keep locale negotiation,
common component catalogs, and system-preference infrastructure outside app folders.
Business-specific catalogs stay with their owning feature. Source technical
content may retain its original language; label that rather than claiming translation.
Translate visible copy, accessible labels, and the document title; update the
document language. Respect preferred-language order and use an explicit fallback
when none is supported; never claim unsupported languages are translated.
Currently English and Vietnamese are implemented, with English fallback and
live `languagechange` handling.

## One visual system, multiple integrations

Harmonize the user's system with one coherent theme and UI language rather than
preserving each product's divergent styling.

- **Style requests are system-wide by default.** When the user asks to change
  theme, colors, typography, shared i18n, contrast, spacing, radii, shadows,
  controls, or another reusable
  visual treatment, change the shared design system or technical component,
  not only the app/screenshot currently being discussed. Apply the result
  consistently across all registered apps and generated host skins. Limit a
  style change to one app only when the user explicitly requests that scope
  or the change belongs to a genuinely product-specific layout/rendering need.
- Update shared primitive/semantic/component roles first, then their consumers
  and native mail, note, and storage adapter mappings. Do not create per-app
  color overrides or duplicate component CSS to make one screen look right.
  Preserve business workflows, task-specific layouts, document content colors,
  and original product logos; consistency does not mean identical screens.
- Typography must be consistent as well as color. Use the shared sans/monospace
  roles from `SingleUI/src/design-system/typography.css` across every app and
  generated skin; do not introduce app-specific families or remote-font
  dependencies. The selected 30s DM Sans/Space Grotesk families are embedded
  locally for consistent offline rendering. Preserve meaningful native icon fonts and user-authored document
  typography. Keep font weights, sizes and line-height consistent by component.
- Keep a short contrast-maintenance instruction in authored shared/adapter CSS.
  Check actual rendered foreground/background pairs, including inherited and
  nested host styles: normal text at least 4.5:1, large text at least 3:1, and
  meaningful icons, control outlines and focus indicators at least 3:1 against
  adjacent surfaces. Check default, hover, active/pressed, selected,
  focus-visible, disabled, loading and error states in both system themes.
  Never let hover/active styling erase a keyboard focus indicator or make a
  selected control unreadable. Pair foreground, surface and outline roles
  deliberately rather than changing one color in isolation.
  Decorative separators need not carry control-boundary contrast. Never make
  text, focus or errors unreadable merely to match a color sample.
- Recheck those states after typography or i18n changes: longer labels, badges,
  validation messages and accessible names must remain legible, unclipped and
  usable without layout shifts. Shared interaction messages belong to reusable
  technical components; keep business-specific terminology with its owner.
- CSS classes and IDs must not gain brand/app namespace prefixes. Use technical
  component names, Angular style encapsulation, and the host's existing native
  selectors at integration boundaries. Existing custom-property compatibility
  names and Angular element selectors are not CSS class/ID prefixes.
- Adopt one neat original application's visual foundation faithfully rather
  than blending unrelated app themes. Keep source revision, hash and any
  intentional transformations accurate; never describe modified CSS as an
  unchanged source copy.
- Rebuild all app entries and portable CSS after shared style changes. Check
  representative apps and supported native hosts in light/dark system modes
  and desktop/mobile layouts. Inspect actual screenshots for clipping,
  overlap, hierarchy, contrast, and component consistency; passing builds or
  root-level color assertions alone do not establish visual quality.
- Inspect the actual existing interfaces before selecting the strongest visual
  foundation. Evaluate clarity, accessibility, responsiveness, and visual quality;
  do not declare a winning theme without evidence.
- Keep theme tokens, typography, spacing, icons, component states, and reusable
  interaction patterns in purposeful shared modules outside app folders.
- Use primitive, semantic, and component token layers. Components consume tokens
  rather than duplicating arbitrary visual values.
- Aim for consistent visual language, not identical layouts or behaviour for
  unrelated tasks. Preserve each application's domain-specific experience.
- Do not assume the existing Angular workspace requires rewriting every current
  React or other-framework application. Provide integrations appropriate to the
  consuming framework.

The user rejected lime/green and the cold Dutch blue palette. Shared colors follow
the warm column of `https://flatuicolors.com/palette/fr`: Squash Blossom actions,
derived deep amber text accents, Jalapeno Red errors and cream light and neutral grey (Facebook-style, untinted) dark system
surfaces. `SingleUI/src/design-system/palette.json` is the single color source;
`npm run palette` regenerates `palette.css` and the matching favicon, and
`--check` enforces contrast pairs. Never edit colors elsewhere. Preserve 30s
DM Sans/Space Grotesk typography and glass geometry; do not introduce per-app themes.
All apps and supported skins must use the same semantic roles, including hover,
active, selected and focus.
`SingleUI\src\design-system\workshop-foundation.css` is an explicitly adapted
foundation. Original 30s source, palette.json and transformed hashes are separate.
Source comparisons and limits are recorded in `SingleUI\docs\style-selection.md`.
Shared `contracts`,
`theme`, `design-system`, `preferences`, `ui`, and `i18n` modules remain outside
apps. Starter entry layout CSS is shared; business layouts remain app-local and
consume shared technical component styles. Three.js geometry/rendering is app-local.
The car scene is representative educational geometry, not an OEM model loader.
Bounded account workflows, nested car studies and the original pure PARA office
runtime are restored. PARA's original React dashboard features are ported
(Graph default view, network, drawer, boards, log, notifications); its polish
uses shared `--emfc-radius-nested` concentric radii, `emfcSpotlight`,
`emfc-area-chart` and `src\i18n` plural/relative-time helpers. Full feature parity
elsewhere and live backend integration are not established. Check README for current limits.

## Target inventory and third-party adapters

The discussed owned-app inventory includes Car 3D Models (30s), Farm, LingoBridge,
Chinese Chess Lovers, PARA-AI/PARA Bridge, and DiskLens.
ProductionCore Aids and Exploring Local are additional UI candidates.
Keep work/client projects such as Bergmomente/HikingReport and MiTekProduction
separate from personal-product scope unless explicitly included.

MailBox is an owned product. Bring its Angular UI into `SingleUI/src/app-mail`,
using the same shared components, fonts, theme and automatic preferences.
Do not classify it as a CSS-only third-party integration or require Docker for
developing its UI. Preserve the existing Flask/Maddy backend boundary; inspect
its real routes and security contracts before wiring a client, and do not invent
a working JSON API where only server-rendered forms currently exist.

Seafile and AFFiNE Notes are deployed open-source integration targets, not
applications to rewrite or bootstrap inside this Angular workspace.

- Where rebuilding a third-party UI is unavailable, deliver product-specific CSS
  overrides and optional embedded JavaScript only where supported.
- Verify each product's actual extension/injection mechanism and supported
  version before implementing an adapter.
- Keep product-specific selectors and compatibility details in its adapter, not
  in universal tokens or components.
- Preserve host-product functionality, accessibility, and security boundaries;
  do not treat permission to theme a product as permission to alter its backend.
- Adapt GitHub Actions to build/version reusable UI packages and product-specific
  CSS/JS artifacts from the same design source. Do not require rebuilding a
  third-party application to consume its skin.
- Respect existing output boundaries. In PARA-AI, the dashboard's `web\dist`
  remains separate from reusable UI/Seafile CSS output in `web\dist-ui`.

The inventory and delivery strategy do not authorize external publication,
deployment, cross-repository edits, or wholesale migration by themselves.

`npm run build:ui` builds portable CSS and legacy browser theme ES modules into
`SingleUI\dist-ui`, with a hashed manifest (CI source revision), CSS-only Seafile
and AFFiNE skins and bundled `INSTALL.md`/font licenses. The local Seafile 11
integration uses native administrator `ENABLE_BRANDING_CSS`/`CUSTOM_CSS` settings,
without restart. AFFiNE maps inspected V1/V2 and selfhost-admin roles; a pinned
derived image adds one same-origin stylesheet link to its six native HTML entries.
Do not invent a CSS admin setting, weaken CSP or rewrite JS bundles/proxy HTML.
`SingleUI\docs\css-installation.md` documents
copy/apply, validation and rollback. Keep it packaged with artifacts.
The workflow tests/builds all registered entries, checks their production output
in browsers and uploads app/CSS artifacts. After both validation jobs pass on
the current main revision, it updates internet-facing's SINGLE_UI_RUN_ID and
SINGLE_UI_REVISION repository and `hostkey-server` environment variables using
GH_PAT in the CI environment.
It does not publish, dispatch consumer workflows or deploy.

## Working practices

Read existing implementation and contracts before editing. Make surgical changes,
preserve unrelated work, and validate the behaviour actually changed. Test module
contracts and error paths, not just compilation. For visual changes, inspect the
rendered UI at relevant desktop/mobile sizes rather than relying only on builds.

Keep these instructions current when the owner changes an architecture decision.
Consult eldervibe shared memory when available, searching broadly for `EMF` or
`EMFc` as well as project-specific terms; an empty narrow search does not establish
that no principles or prior decisions exist.
