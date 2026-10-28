# Static app bundles and consumers

## Find and download

Open this repository's **Actions > SingleUI apps and skins > successful main run >
Artifacts**. **single-ui-apps** contains all ten `app-<id>/` directories; each is
a complete static entry with `index.html`, hashed assets and
`bundle-manifest.json` (app ID, full source SHA, base href, SHA-256 of every file).
No Node server, backend, credentials, local disk data or API is inside a bundle.
**single-ui-css** contains Seafile/AFFiNE skins, font licenses, `manifest.json`
and `INSTALL.md` with version-specific selfhost installation and rollback.

```bash
gh run list --repo quocchungthan/EMFc-experiments --workflow single-ui.yml --branch main --status success
gh run download RUN_ID --repo quocchungthan/EMFc-experiments --name single-ui-apps --dir downloaded-apps
gh run download RUN_ID --repo quocchungthan/EMFc-experiments --name single-ui-css --dir downloaded-css
```

Replace `RUN_ID` with the selected numeric run ID. GitHub requires authentication
for Actions downloads, including public repositories. Automation tokens need
Actions:read on the producer and Contents:read when checking out the importer.
Artifacts have **90-day retention**, subject to repository/organization limits.
They are not permanent releases, public anonymous CDN URLs or npm packages.
Keep an operator-controlled verified copy for long-term rollback; never put an
Actions download token in browser code.

## Automatic internet-facing pins

After both app/bundle validation and native host-skin validation succeed on a
`main` push or manual run, CI updates the `quocchungthan/internet-facing`
repository variables and `hostkey-server` environment variables
`SINGLE_UI_RUN_ID` and `SINGLE_UI_REVISION` to that run ID
and full source SHA (because `internet-facing` deployment jobs run inside
`environment: hostkey-server`, environment-scoped variables shadow repository
variables unless both are updated). Pull requests and non-main runs cannot update the pins.
Updates are serialized and revisions no longer at the tip of `main` are skipped.
The producer's `CI` environment must contain `GH_PAT`, with Variables and
Environments read/write permissions on `internet-facing`; its default `GITHUB_TOKEN` cannot write another
repository's variables. Missing credentials or failed writes fail the promotion
job explicitly. GitHub updates the variables separately, not atomically;
after a failed write, rerun the job successfully before starting a consumer.
This only advances the pins: it does not dispatch a consumer workflow, deploy
services, or replace the consumer's separate artifact-read credential.

## Reproducible consumer installation

Check out the producer at the selected full source SHA, then run its dependency-free
Node 22 importer with `gh` installed/authenticated:

```bash
export SINGLE_UI_RUN_ID=123456789
export SINGLE_UI_REVISION=FULL_40_CHARACTER_SOURCE_SHA
node SingleUI/deployment/artifacts/import-app.mjs disklens EMPTY_OUTPUT_DIRECTORY
```

The importer accepts only successful `push`/manual main-branch runs of this
repository's `single-ui.yml`, checks the pinned SHA and every bundled file,
and refuses an occupied destination. Use a new staging directory, verify it,
then replace the host's previous frontend through its normal release process.
The package layout differs from the earlier raw `dist/app-ID/browser` artifact:
the new `app-ID/` folder is already the browser root, without `browser/`.

## Host contracts

| Consumer | App | Frontend mount | API/auth boundary |
| --- | --- | --- | --- |
| quocchungthan.github.io | productioncore-aids | `/tools-w-productioncore-aids/` | `http://localhost:5311` |
| quocchungthan.github.io | disklens | `/tools-w-disklens/` | `http://127.0.0.1:5274` (IPv4 loopback service) |
| quocchungthan.github.io | exploring-local | `/tools-s-exploring-local/` | `http://localhost:5312` |
| internet-facing `sub/mail` | mail | `/`, `/login`, `/auth/choose`, compose/message paths | Same-origin `/api/mail/*`, server-owned OAuth/selection, server-side mailbox credentials |
| internet-facing main Farm | farm | `/`, `/connect`, existing portfolio aliases | Same-origin APIs, Fences auth/callback and diagnostics preserved |
| internet-facing `sub/identity` Fences | identity | `/`, authenticated `/apps` | Same-origin APIs; GitHub/OIDC, callback/return URL policy, owner authorization remain server-owned |
| Chinese Chess Lovers (Vercel) | chinese-chess-lovers | `/` | Retain existing `/api/*`, `/admin/*`, MCP/auth and backend routes before static fallback |

Pages retains its original landing and PARA Bridge build; there is no workspace
portal or CarResearch/car-search entry. Keep API ports, CORS trusted origins,
private-network permission guidance, start commands and source links. Never work
around browser local-network restrictions by disabling security. Samples must be
clearly labeled; command failures must not fall back to fabricated results.

Mail's coordinated source integration targets `internet-facing`'s `sub/mail`
branch. Its JSON facade and frontend handoff must
ship together; do not deploy the Angular frontend against the old HTML-only
server. Login/chooser presentation uses the bundle; OAuth, authorized mailbox
selection and session handling remain server-owned. SMTP acceptance is not delivery;
an accepted message whose Sent copy failed must not be resent automatically.
Run backend tests and a real staging SSO/mailbox/receipt journey before promotion.

Identity's `/api/session` includes the public `brandName` in both signed-in and
signed-out responses, sourced from Fences `IdentityApp:BrandName` (the deployment's
`FENCES_BRAND_NAME`). Ship that backend field with the frontend so the header,
welcome message and localized document title reflect runtime configuration.
Older servers without the field show a neutral Identity label, not a sample brand.

## Vercel / Chinese Chess Lovers

The Chess integration downloads the pinned `chinese-chess-lovers` directory
**during CI/build**, preserves serverless/API/admin/MCP route ownership, and
serves Angular at `/` and `/room/:code`, including the legacy `/?room=CODE`
entry. The public arena retains original board/piece artwork, 3D/flip controls,
turn clocks, seat connection/reconnection guidance, server-generated agent
prompts, MCP endpoint copying, AI/audience insight, activity and OBS view.
Public spectators copy legal moves; they do not issue operator commands.
Local servers use room WebSockets; Vercel uses its advertised polling mode.
The same bundle now supplies `/admin`, `/admin/room/:code` and
`/admin/pair/:id`. Native authentication and access checks protect these
entries before HTML is served; the backend still owns all operator APIs.
The Angular operator UI includes native seat/model configuration, pairing
confirmation/decisions, audience controls/comments, authorized board actions,
draw/end/rematch and share links. It never substitutes operator commands.
The consumer removes the legacy Vite UI and `operator.html`, rather than
retaining an obsolete administrator interface. Native local/PostgreSQL browser
checks exercise the imported bundle; Vercel restrictions still apply.

For a static-only Vercel project, the verified app directory can be the Output
Directory. For a mixed backend project, retain its framework adapter and expose
the bundle through its existing static/public boundary. Do not set the entire
project to a static output or add a global SPA rewrite that swallows API, admin,
OAuth or MCP requests. Vercel Build Command credentials are server-only
environment variables, never `VITE_*`/public Angular configuration. Use a narrowly
scoped Actions-read credential and pin both run ID and source SHA. Vercel
previews must not receive production auth secrets.

## Seafile and AFFiNE selfhost

Download **single-ui-css**, not an Angular app, and retain its manifest/licenses.
Its bundled `INSTALL.md` is the self-contained copy of
[css-installation.md](css-installation.md): Seafile 11 uses native administrator
`ENABLE_BRANDING_CSS`/`CUSTOM_CSS`; AFFiNE uses a version-pinned derived image with
one same-origin stylesheet in its six native HTML entries. Neither requires
rewriting the host UI, changing its backend, weakening CSP or modifying JS bundles.
Back up current CSS/image, verify exact target-version support and hashes,
inspect light/dark desktop/mobile screens, then use the documented rollback.

The `internet-facing` **sub/note** branch hosts native AFFiNE under
`Streams/DaHang`. Its manual **Apply Note Style** workflow imports the verified
CSS artifact and updates only a derived frontend image on the existing deployment.
It refuses a different deployed AFFiNE base digest rather than upgrading the
backend or running database migrations. This requires the private-artifact
credential and existing deployment-directory configuration; publishing an
artifact alone does not install it on the host.

## Local reproduction

```bash
npm ci
npm run build:apps
# Set GITHUB_SHA to the full commit being packaged; do not label uncommitted changes a release.
npm run package:apps
npm run build:ui
```

CI runs unit, artifact-integrity, bundle-isolation and browser checks before
uploading deliverables. A green fixture run does not prove real backend login,
mail delivery, deployment or full original feature parity.
