# SingleUI

Shared Angular workspace generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.27.

Each product has a separate `src/app-<id>` entry. The surrounding framework keeps
`src/main.ts`, `src/index.html`, `src/styles.css`, `public`, and build selection
outside the app folders. Seafile and AFFiNE are CSS integration targets, not apps.

Backend publication is tracked outside this UI workspace in the repository-level
[API publication plan](../docs/api-publication-plan.md). Mail's `/api/mail/*`
facade is implemented in the coordinated `internet-facing` `sub/mail`
integration source; the original server-rendered revision lacks it. Deployment
and live OAuth/mail receipt remain separate acceptance gates.

## Download deployable bundles

**Actions > SingleUI apps and skins > successful main run > Artifacts** provides
**single-ui-apps** (ready-to-serve `app-ID/` entries with revision/hash
manifests) and **single-ui-css** (Seafile/AFFiNE skins plus self-contained
installation tools). Retention is 90 days, not a permanent package registry.
See [bundle retrieval and consumer contracts](docs/bundle-installation.md) and
[selfhost CSS installation/rollback](docs/css-installation.md).
Pages, Farm, Mail and Chess consumer integrations pin a successful run and full
source SHA; source changes alone do not establish live deployment or parity.

## Standalone entries

Launching an app shows only that app's entry: no workspace navigation, SingleUI
branding, appearance/language pickers, or framework demo content. There are eleven
canonical entries. Every entry has an Angular product experience restored from its
original. Mail has
inbox/thread/message/compose views for the Mail JSON facade. Identity has the Fences login
and workspace hub. The shared API source contract selects live or substitute behavior
with `?api=auto|live|substitute`, and `?scenario=default|signed-out|empty|failure|loading`
makes applicable substitute states deterministic. Substitute data is always labeled
and stays in the browser. Source-switch controls and live-service labels appear only
in development or with an explicit `?api=` diagnostic selection. Normal production
pages omit them; automatic fallback still shows a concise preview-data warning.

| `--app` value             | Entry                         |
| ------------------------- | ----------------------------- |
| `car-3d-models` (default) | Universal car-model viewer    |
| `car-knowledge`            | Car knowledge graph and learning |
| `farm`                    | Farm                          |
| `lingobridge`             | LingoBridge                   |
| `chinese-chess-lovers`    | Chinese Chess Lovers / Kỳ Hội |
| `para-ai`                 | PARA-AI / PARA Bridge         |
| `disklens`                | DiskLens                      |
| `productioncore-aids`     | Production Core Aids          |
| `exploring-local`         | Exploring Local               |
| `mail`                    | Owned MailBox UI              |
| `identity`                | Fences / Shuneo Identity       |

`30s` aliases `car-3d-models`; `para-ui` aliases `para-ai`. Neither creates a
duplicate app or build output.

Car Knowledge is independent of PARA's orchestration dashboard. It owns the
definition graph, explanations and its cloned Bobby companion, and reads
`/api/car-knowledge` from the standalone car API at `http://localhost:5311`.
Start it from PARA-AI-solution with `dotnet run --project src/Car`, then run
`npm start -- --app=car-knowledge` here. No Bridge or Copilot sign-in is needed;
PARA's dashboard still connects separately to port 5310. The car origin also
owns vehicle/assembly reads, GLB asset URLs and transcript submission. Do not run
another local service (including ProductionCore Aids' default backend) on port 5311
at the same time. Car Knowledge does not load
session polling, task boards or the PARA office. Its graph/3D views read
vehicle configurations and recursive imported-GLB assemblies from that backend;
selection links back to the same definition panel. Missing geometry is explicit.
Choose a vehicle once in the page header; **Term map** and **3D assembly** tabs
switch the stage with keyboard navigation. The detail panel leads with the
explanation, followed by photographs and connections; transcript entry stays
below it. The collapsible **Drawings & placement** workspace follows exploration.
Its drawing target follows the focused term automatically: choose **Car** on
the map for a whole-car drawing. There are no duplicate vehicle, whole-car/word,
or word-picker controls; no selected vehicle means uploads remain unavailable.
New-car entry is a separate disclosure, with drawing import and placement
side by side on desktop and stacked on mobile. **Download GLB** exports the loaded
assembly with original materials and source/definition metadata. Importing that
file as geometry does not recreate its semantic catalog. Vehicle options come
only from PostgreSQL imports, not from frontend fixtures. Credited Commons
photographs cover the sample configurations' main systems as generic references,
not verified model-year fitment.
The updated Car backend stores imported GLB bytes in PostgreSQL. Standalone Car
startup applies pending schema migrations before serving; back up existing
databases and obtain shared/production migration approval before upgrading.
Run `--car-store-assets` once on the machine with legacy model files.
Alternatively, `dotnet run --project src/Car -- --car-sync-assets` explicitly
migrates/backfills before starting the API; errors stop startup.
After successful backfill, sharing/restoring the database is sufficient for 3D
models on another machine; asset API URLs and this frontend stay unchanged.
Transcript files and externally hosted example photos remain separate.
Selecting a word in 3D mode isolates all matching occurrences and their subparts
and frames only that geometry. Choose **Car** to restore the whole vehicle.
Words without mapped geometry show an empty stage with the missing-drawing message.
**Download GLB** still exports the full assembly, not just the isolated selection.
The transcript form saves pasted source text through `POST /api/car-transcripts`
without overwriting existing text or automatically publishing extracted knowledge.
Three attributed real-photograph examples are generic learning references, not
vehicle-specific fitment evidence. Car Knowledge and the existing car-model
workshop remain separate entries; the latter's procedural drawings are not
silently presented as imported OEM assets.

The car workshop includes original validated catalogs, schematic Three.js
rendering, selection/history, lessons, reference photographs, field books,
camera/view controls, PNG capture, a safe wiper-check flow and local observations.
Farm restores the portfolio sections and API console with presentation-only JSON
field filtering, relative update times, Overview metrics/activity without redundant
description/profile cards, and featured-first
projects. The launcher names its last service "Plan B in my 30s"; Case files retains
the original work-item content. PARA restores the original
React dashboard: notifications bell/toast, Graph (default) and 3D office views,
pan/zoom orchestration network, team assignments, session phases and work queue,
throughput/health charts, activity log with level filters, agent cards with
shape-coded glyphs, the session drawer (resume command, linked assignments,
approve/defer replies, 5s inspector polling) and the offline start guide with
competitors. Shared helpers added for it: `--emfc-radius-nested`, `emfcSpotlight`,
`emfc-area-chart`, and locale-following relative-time/plural formatting.
Farm and PARA use a shared source mode that labels substitute data separately from live service results; live mode retains Bridge polling and failures remain visible. Mail's substitute includes sample folders/threads and browser-local compose, clearly marked `Saved locally · not sent`. Its coordinated Flask facade preserves server-owned SSO, mailbox authorization and CSRF; local fixtures do not verify live mail.

Car also includes nested engine studies, assembly selection and onboarding;
Farm includes account/Connect workflows and explicitly fictional demonstration
analytics; PARA includes its original pure office runtime and animated renderer.
Chess restores the original arena artwork and 3D/flip board, agent prompts and
reconnection guidance, clocks, AI/audience insight, activity and OBS view;
the Angular operator pages preserve native configuration, seat creation,
pairing decisions, voting/moderation, draw/end/rematch and board commands.
Authentication, local-only access and API enforcement remain backend-owned;
operator actions never use substitutes, and Vercel still disables persistent
house AI and TikTok workers.
Commands, Markdown fences, JSON diagnostics and Farm MCP/prompts use one shared
copyable code-block component with explicit clipboard failure.
Code content has a distinct theme-following inset surface (darker than cards in
dark mode) and decorative line numbers; copying preserves the original text.
Farm's connected-client form and key rows use aligned, responsive fields and
localized timestamps with the original ISO time available on hover.
These are not claims of complete migrations or verified feature-identical replacements.
Live integration is capability-specific: Farm's native portfolio collections
are mapped and deployed, while authenticated account/mail journeys and full
feature parity are not established by public-page or fixture checks.
Source technical lessons and backend content retain their original language;
localized interface chrome does not imply translation of that content.

| Module                                           | Public contract                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `src/contracts/theme.ts`                         | `ThemePreference`: `system`, `light`, or `dark`; invalid values throw                  |
| `src/theme/runtime.ts`                           | `getTheme(root)` and `setTheme(root, preference)` operate on the supplied element only |
| `src/design-system`                              | 30s-derived foundation, original fonts, focus and semantic/control aliases             |
| `src/contracts/locale.ts`                        | Resolve supported languages from browser preferences in order; English fallback        |
| `src/i18n/localization.ts`                       | Typed locale negotiation/access; common messages belong to reusable components         |
| `src/ui`                                         | Shared technical components, opt-in styles and component-owned messages                |
| `src/contracts/entry.ts`, `src/ui/entry-page.ts` | Presentation contract and reusable entry composition, not domain models                |
| `src/preferences`                                | Automatic system theme and browser language initialization with listener cleanup       |
| `src/adapters/seafile.css`                       | Native bridge installed through Seafile 11 admin custom CSS in local checks            |
| `src/adapters/affine.css`                        | V1/V2/admin bridge installed with a pinned derived image in local checks               |

`src/main.ts` initializes shared system preferences before bootstrapping the app.
Theme follows `prefers-color-scheme` live, without a user override or stored choice.
Language follows `navigator.languages` (or `navigator.language` if the list is
empty) and updates on `languagechange`, including document language and page title.
This revision supports English and Vietnamese, matching regional tags such as
`en-GB` and `vi-VN`. The first supported language in the preference list wins;
if none is supported, English is the documented fallback. It does not claim
automatic translation into unsupported languages.

The **selected** warm French Flat UI palette uses amber actions, warm focus and
cream/espresso system light/dark surfaces, replacing the rejected lime/green and cold
blue palettes. Colors live only in `src/design-system/palette.json`; `npm run palette`
regenerates `palette.css` and the matching `public/favicon.svg`. It keeps
30s DM Sans/Space Grotesk typography and component geometry. See
[the evidence and selection rationale](docs/style-selection.md), including the
unavailable chess source and limits of the audit. Layout and controls are imported
from `src/design-system` and `src/ui`, never duplicated as app-specific themes. Contracts,
models and API clients remain bounded modules outside apps; this revision does
not invent unused domain/API scaffolding. App roots compose focused features.
Car rendering/assets belong to the car app; PARA owns its independent office
renderer. Other entries do not import these renderers. Car media/books are
copied only into the car build.

## Identity (Fences)

`npm start -- --app=identity` launches the standalone Shuneo identity experience:
GitHub sign-in/out, service cards, account details, owner-only audience (7/30/90
days, daily growth and observed users), and read-only GitHub repository listing.
Original view boundaries are `internet-identity/Fences/Views/Home/Index.cshtml`
and `Views/Shared/_Layout.cshtml`; API shapes were verified in Session,
Audience and Github controllers and `Services/AudienceStore.cs`.

The coordinated `internet-facing` `sub/identity` host consumes this bundle at
`/` and authenticated `/apps`, replacing its original Razor presentation.
The client uses same-origin credentialed `/api/session`, `/api/apps`,
`/api/audience` and `/api/github/repos` routes. Login navigates to `/auth/login`
with the explicit `returnUrl`, legacy `callbackUrl`, or current location;
logout returns to the identity root. The backend still approves return targets.
Standalone Angular development uses substitutes unless served/proxied through
the identity backend; it does not silently call production identity.
No token is requested,
stored, printed, or exposed by this UI. Repository creation/clone-token APIs are
intentionally outside this read-only clone.

Live is attempted first; unreachable session APIs use clearly labeled browser
substitutes. `?api=substitute&scenario=default|signed-out|empty|failure|loading`
exercises sample states; `?api=live` forbids fallback. Login, logout, and service
links still open real destinations; sample repository links are disabled.
Audience/repository failures never convert a real session into a sample owner.
Audience 401/403/404 hides that panel; repository 401/403 requests reconnection.
Owners must enter a configured **OAuth client ID** (or supply `?clientId=...`);
service keys/URLs are not assumed to be OAuth client IDs. The initial empty-ID
400 response identifies the owner-only form without inventing a client registry.
Substitutes use the fictional `farm-web` client. Counts describe observed app
authorizations, not registrations, login counts or online presence; chart values
are sparse daily new-user counts filled with zeros, never cumulative totals.
The shared `ui/count-chart.ts` keeps integer axes and date labels legible on
small screens and provides an expandable daily-value transcript.
Brand defaults to Shuneo as in the original view; the session API does not publish
the configurable backend brand. Live service names/descriptions retain their
source language. English/Vietnamese interface, shared fonts, colors and automatic
system preferences are used throughout. Running live backend/OAuth verification
is not claimed by fixture tests.

## Shared presentation boundaries

`src/ui/tabs.ts` provides underlined tabs with selected/focus states, arrow-key
navigation and tab/panel associations; apps supply localized labels and content.
`src/ui/markdown.ts` renders GFM prose through Angular sanitization, preserving
chapter anchors while escaping other raw HTML. Field books
consume that renderer rather than displaying Markdown source.
`src/ui/components.css` composes focused foundation, data-display and motion
styles; portable builds flatten the same imports. Car scene lifecycle stays in
`car-scene.ts`, while vehicle construction and mesh primitives live in
`vehicle-drawing.ts` and `drawing-primitives.ts`, all inside the car app.

## Requirements

Use Node.js 20.19+ (20.x), 22.12+ (22.x), or 24.x and npm 10.8.2 or later in the npm 10.x series.
From this directory, install the dependencies with:

```bash
npm ci
```

Use `npm install` when changing dependencies, and commit the updated `package-lock.json`.

## Development server

Start a local development server with:

```bash
npm start -- --app=car-3d-models
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

The same `--app` flag selects the entry for start, build, watch, and test. For example:

```bash
npm start -- --app=lingobridge
npm run build -- --app=disklens
npm run watch -- --app=farm
```

`apps.json` lists supported IDs. The launcher combines production/development
mode with the selected Angular file-replacement configuration in the `single-ui`
project. `src/main.ts` imports only the selected entry through `src/selected-app.ts`;
it does not ship a runtime app chooser. Other apps are not bootstrapped alongside
the selected one. Unknown, missing and duplicate IDs fail explicitly.

Use `--configuration=development` or `--configuration=production` for build/start.
Selection-related Angular overrides (`--browser`, `--build-target`, `--project`,
`--file-replacements`, `--output-path`) are managed by the launcher, not forwarded.
Other options such as `--port`, `--host`, `--watch`, and `--help` are forwarded.
Tests use the selected development build target and run the workspace unit suite.

To add an entry, create its app folder and external typed catalog, add its ID to
`apps.json`, and add its file-replacement configuration in `angular.json`.
Update browser identity expectations. Shared unit tests cover UI/preferences,
not complete domain integrations.

## Building

To build the project run:

```bash
npm run build -- --app=car-3d-models
```

Each selected app is written independently to `dist/app-<id>/browser`.
Build every entry with `npm run build:apps`. By default, production builds optimize
the selected entry; building another app does not overwrite previous app outputs.
Run `npm run test:bundles` after all-app builds to verify import-graph and asset
isolation, including absence of Three.js in entries that do not use it.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
npm test -- --app=car-3d-models
```

Run `npm run test:launcher` to check app selection and CLI argument forwarding.

## Portable CSS/JS artifacts

Build the shared UI independently of Angular:

```bash
npm run build:ui
npm run test:ui
```

Output goes to `dist-ui`, separate from the car app's `dist`:

- `emfc-ui.css`: shared warm palette root roles and opt-in `.button`, `.select`,
  and `.panel` styles. No app viewport layout or runtime remote font requests.
- `FONT-LICENSES.txt`: original embedded DM Sans/Space Grotesk SIL OFL notices.
- `emfc-theme.js`, `theme/runtime.js`, and `contracts/theme.js`: browser ES modules
  with no Angular dependency or automatic document changes.
- `seafile-candidate.css`, `affine-candidate.css`: self-contained CSS-only variable
  bridges, defaulting to system appearance even without JavaScript.
- `INSTALL.md`: copy/apply, compatibility, validation and rollback instructions.
- `manifest.json`: package version, CI source revision, selected-theme/adapter
  status, and SHA-256 hashes.

For an owned host, load `emfc-ui.css` after base styles and use the opt-in
classes on controls. The root roles are global, not an isolated embedded-region
reset. Optional legacy metadata integration:

```js
import { setTheme } from './dist-ui/emfc-theme.js';
setTheme(document.documentElement, 'system');
```

Legacy theme values remain accepted as metadata by the portable API; they do not
override the selected foundation's OS-driven CSS. First-party apps use system
appearance only and expose no picker.

Keep the generated directory structure when hosting these modules. Follow
[the CSS installation guide](docs/css-installation.md) for concrete copy/apply and
rollback steps. The local Seafile 11 integration uses native administrator
custom-CSS settings; AFFiNE uses a pinned derived image with an additional
same-origin stylesheet in its six native HTML entries. Real-host checks cover
selected login, editor/sidebar, library and dialog screens. Revalidate your
target version before deployment; this is not complete host recoloring.

`.github/workflows/single-ui.yml` checks/builds every entry and portable outputs.
It uploads `single-ui-css` (including `INSTALL.md`), `single-ui-apps`, and browser
results as workflow artifacts. A separate job builds isolated native note/storage
containers, installs the generated CSS and uploads their screenshots. It does not
publish packages or change production deployments. Mail UI development is
independent of Docker; see the repository-level API plan for backend publication.

## Browser checks

```bash
npx playwright install chromium
npm run build:apps
npm run test:browser
```

Playwright starts/stops a small loopback-only server for the **built production
entries**, with an isolated port per app. It checks actual selected identity,
responsive layout,
keyboard access, live system appearance, automatic English/Vietnamese selection,
unsupported-language fallback, actual text contrast, and the CSS-only variable
bridges. Screenshots are written under `test-results`. After source changes,
rebuild entries before rerunning browser checks.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
