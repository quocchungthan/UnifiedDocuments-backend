# Installing the shared CSS

These artifacts style applications; they do not deploy them or publish business
APIs. For that separate work, see the repository-level
[API publication plan](../../docs/api-publication-plan.md).

## Artifacts and shared behavior

From SingleUI, run `npm run build:ui`, or download **single-ui-css** from a
successful **SingleUI apps and skins** Actions run. Keep `manifest.json` with the
files: it records their SHA-256 hashes, foundation provenance and CI revision.
Version `0.0.0` alone does not identify a release.

| File                                    | Purpose                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `emfc-ui.css`                           | Shared foundation and opt-in component classes for an owned host.                               |
| `seafile.css`                           | Native Seafile login/library/navigation/dialog bridge.                                          |
| `affine.css`                            | Native AFFiNE V1/V2 interface and selfhost-admin bridge.                                        |
| `mail.css`                              | Optional compatibility skin for the original Flask MailBox; not the main Angular Mail strategy. |
| `*-candidate.css`                       | Compatibility filenames containing the same corresponding host CSS.                             |
| `emfc-theme.js`, `theme/`, `contracts/` | Legacy portable metadata helpers; preserve directory structure if used.                         |
| `INSTALL.md`, `manifest.json`           | Installation guidance, source revision and file integrity.                                      |
| `Dockerfile.affine`, `affine-install-style.mjs`, `affine-image.txt` | Self-contained pinned AFFiNE image extension; no source checkout required. |

All bundles include the shared warm amber/cream foundation generated from `palette.json`, followed by
embedded original DM Sans/Space Grotesk fonts and shared focus treatment.
Retain `FONT-LICENSES.txt` with redistributed CSS. Appearance follows the OS through CSS
media queries. Legacy light/dark metadata helpers do **not** override the shared
foundation's OS-driven CSS. Do not add an appearance picker to owned apps.

Load `emfc-ui.css` after an owned host's base styles, then use technical classes:

```html
<link rel="stylesheet" href="/assets/emfc-ui.css" />
<section class="panel">
  <button class="button">Your action</button>
</section>
```

The foundation has global root roles; this is not an isolated embedded-region
reset. Review interactions with the host's existing CSS before adoption.
CSS does not translate content; owned apps use browser-language negotiation.
Preserve native icon fonts, authored document typography and brand artwork.

## Seafile 11.0.12

The isolated harness uses the native **System Admin custom CSS** web settings,
not a guessed file path or restart hook. Validate your own version first.

1. Back up the current `ENABLE_BRANDING_CSS` and `CUSTOM_CSS` values.
2. Through the approved administrator UI or API, enable custom CSS and paste the
   **contents** of `seafile.css`, not its filename or a `<style>` wrapper.
3. The tested API operation is `PUT /api/v2.1/admin/web-settings/` with JSON
   `{ "ENABLE_BRANDING_CSS": "1", "CUSTOM_CSS": "<CSS contents>" }` and a
   server/operator-held administrator token. The local harness obtains its
   ephemeral token via `/api2/auth-token/`; do not put it in the Angular client,
   source files, command logs or documentation examples.
4. Verify `/custom-css/` returns the installed CSS and inspect login, libraries,
   navigation, new-library dialog, text, input borders and keyboard focus in both
   OS themes and narrow/wide viewports. No Seahub restart is needed.

Rollback by restoring both previous settings and hard-refreshing. Do not combine
this with the legacy `BRANDING_CSS` file mechanism. Older versions may require
that mechanism and custom-directory symlinks; they are not validated here.
Use the [version-matched upstream manual](https://manual.seafile.com/latest/config/seahub_customization/).

## AFFiNE Notes

The harness builds an **operator-owned derived image** from the pinned official
image in `deployment/local/sources.json`. It copies `affine.css` to
`/app/static/single-ui.css` and adds a same-origin, hash-versioned stylesheet
link to six actual native HTML entries:

```text
/app/static/index.html
/app/static/selfhost.html
/app/static/admin/index.html
/app/static/admin/selfhost.html
/app/static/mobile/index.html
/app/static/mobile/selfhost.html
```

See `deployment/local/note/Dockerfile` and `install-style.mjs`. The installer
fails if the expected files/head tags are missing. It does not rebuild React,
modify JS bundles, rewrite proxy HTML or weaken CSP. This is a version-specific
image extension, **not** an upstream admin Custom CSS feature.

The downloaded **single-ui-css** artifact includes an equivalent self-contained
Dockerfile/installer and the tested upstream image digest. From the extracted
artifact directory (with `affine.css` beside the Dockerfile), run:

```bash
docker build -f Dockerfile.affine -t affine-shared-ui:reviewed .
```

Use that derived image in your existing selfhost deployment, preserving its
environment, database, storage and volumes. The default base is pinned to the
recorded tested digest, not floating `stable`; upgrading the base requires
revalidating all six entries before deploying.

Build and deploy through your normal image pipeline, preserving upstream volumes
and configuration. Confirm `/single-ui.css` matches the artifact hash and test
native editor/sidebar, mobile collapse, selfhost setup/admin and both system
themes. Document colors, highlights and user content are deliberately not
universally recolored. A changed upstream HTML layout requires revalidation.

Rollback by deploying the previous image with the same persistent data. Never
delete note volumes to roll back a stylesheet.

## Mail is first-party

Develop the owned Angular UI with `npm start -- --app=mail`; Docker is not needed
for that UI. Its JSON facade is implemented in the coordinated `internet-facing` Mail
integration source, but publication and live SSO/receipt still require staging.
Browser fixtures do not establish sending.

The old Flask skin remains an optional source-reference tool. To stage it,
set `INCLUDE_MAIL_REFERENCE=1` for `npm run skins:prepare`, with an accessible
internet-facing source checkout at `INTERNET_FACING_DIR`, then explicitly enable
Compose profile `mail-reference` and start `mail`. This is not part of required
note/storage CI. It replaces the original native shared variables asset only.
Rollback that reference skin by restoring the original asset/rebuilding its image.

## Reproduce external-host checks locally

Docker must already be available. From SingleUI:

On memory-constrained machines, run one platform at a time:

```bash
npm run test:hosts:isolated -- storage
npm run test:hosts:isolated -- note
```

With no argument, `test:hosts:isolated` runs storage then note sequentially.
This uses fresh, uniquely named Compose projects and disposable credentials
passed directly in the process environment, without reading an environment file.
Each host and its database/cache are removed before the next starts, including
only that test project's temporary volumes. Existing host data is untouched.
Keep ports `8112` and `8113` free before running. Screenshots are retained under
`test-results/hosts/storage` and `test-results/hosts/note`.

For persistent local test accounts instead:

```bash
npm run skins:prepare
npm run skins:up
npm run test:hosts
npm run skins:down
```

Only localhost ports `8112` (note) and `8113` (storage) are published by required
services; databases/caches have no host ports. Credentials are generated into
ignored `.local/skins.env`; existing local values are preserved. No production
secrets or deployment configuration are read. Keep local test accounts isolated.
`skins:down` retains volumes; do not remove them to apply CSS.

The suite installs Seafile CSS through its real API, verifies exact served CSS
hashes and captures real native UI screenshots. Inspect those images, not just
passing root-variable assertions. These checks cover selected screens of pinned
versions, not every feature or production deployment. Current machine-readable
adapter status remains `requires-host-validation` for any target installation.

## Upgrade and accessibility gate

Keep the previous image/CSS/settings. Rebuild the artifacts, stage the exact
target host version, compare manifest hashes and repeat UI checks after every
host upgrade. Do not overwrite existing custom branding without review.

Use shared fonts and test actual foreground/background combinations in both
system themes. Normal text needs at least 4.5:1; meaningful icons, control
outlines and focus indicators need 3:1 against adjacent surfaces. Check default,
hover, active/pressed, selected, focus-visible, disabled, loading and error
states. Longer translations must not clip or obscure controls. Inspect actual
rendered pages at narrow and wide widths; inherited native styles can override
an otherwise correct root token.
