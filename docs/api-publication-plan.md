# API publication and UI integration plan

**Status:** proposed delivery plan, not a declaration that these APIs are deployed.
This document belongs to EMFc, outside `SingleUI/`, because API publication is
backend work with a lifecycle independent of any one UI implementation.

**Artifact migration update:** coordinated consumer source now implements the
Mail JSON facade on `internet-facing`'s Mail integration branch and imports
`app-mail`; Farm main imports `app-farm` while retaining its existing APIs/auth.
The original Mail revision inventoried below remains HTML-only. The Mail slice
is implemented/tested in the new source, not claimed live solely because that
source or browser fixtures pass. Static download/host contracts and
Seafile/AFFiNE installation are in `SingleUI/docs/bundle-installation.md`.

## Goal and boundaries

Let the existing systems expose stable, authenticated interfaces that SingleUI
and other clients can consume without importing their backend code, scraping
HTML, accessing databases directly, or putting server credentials in browsers.
Keep each system's business rules and data with its existing owner.

SingleUI owns presentation and interaction. It shares technical components,
typography, system appearance, locale negotiation and accessibility behavior.
It does not become a universal business backend. Car rendering and workflows
remain in the car app; publishing a mail API must not add mail or Three.js
dependencies to unrelated app bundles.

Prefer JSON REST over HTTPS for ordinary reads and commands. Retain an existing
well-supported API instead of translating it merely for uniformity. Consider
server-sent events for one-way live updates only when polling is insufficient;
use WebSockets only for demonstrated bidirectional requirements. File transfers
use bounded streaming/download endpoints rather than JSON-encoded file bodies.
No new gateway service or message broker is required for the first rollout.

## What exists, and what does not

This inventory distinguishes source/client evidence from verified deployments.
It must be refreshed against each backend's source and a running staging instance
before implementing a migration.

| System                | Current evidence                                                                                                                                                                                                                                                                                     | Publication/integration work                                                                                                                                                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Farm                  | Clients use `/api/portfolio/*`, `/api/feeds`, `/api/tools`, `/api/metadata`, `/api/me`, `/api/dashboard` and `/api/memory/*`. See `SingleUI/src/api/farm/`.                                                                                                                                          | Confirm backend schemas, authorization, CSRF, rate limits and error behavior. Existing client declarations are not proof that every route is deployed or compatible. Connect against staging before enabling live writes.                                                                       |
| PARA Bridge           | Client uses `http://localhost:5310/api/snapshot` and session `inspect`/`reply` routes. See `SingleUI/src/api/bridge/client.ts`.                                                                                                                                                                      | Keep localhost development support; add an authenticated HTTPS deployment path and explicit origin policy before remote use. Verify snapshot/reply contracts and reconnect behavior. Do not expose an unauthenticated local bridge to the internet.                                             |
| MailBox / Maddy       | Inspected Flask source at internet-facing revision `5e4b7d76e73ca98b80f992f9299ca6adc0c06c2d`: SSO, mailbox selection, inbox/sent pagination, message reading, composing and logout are server-rendered routes. POSTs check a session-bound `csrf` form field. Mailbox credentials stay server-side. | Publish a JSON facade over existing application operations. The Angular `app-mail` client contract below is **proposed**; the inspected backend does not implement `/api/mail/*`. Until publication, show an explicit substitute/unavailable state; browser samples and local compose must be labelled as substitute data and `Saved locally · not sent`. Fixture journeys do not establish live mail functionality. |
| Car 3D Models / 30s   | Catalogs/assets and field books are bundled; observations are browser-local in `SingleUI/src/api/cars/observations.ts`.                                                                                                                                                                              | No server is required for current local behavior. Define a separately authorized observation-sync API only if cross-device persistence is needed. Never imply local storage is server sync.                                                                                                     |
| Seafile storage       | Native Seafile 11 administrator web-settings API is used to install custom CSS in the isolated host harness.                                                                                                                                                                                         | This administrative CSS operation is not a file-access integration. Use the supported upstream file/library APIs if a storage client is later requested. Do not send administrator tokens to SingleUI.                                                                                          |
| AFFiNE notes          | Local container serves its native application with a derived-image stylesheet installation.                                                                                                                                                                                                          | Styling does not establish a notes data API. Evaluate the pinned upstream supported interface before promising note CRUD or sync; retain the native UI if no suitable supported contract exists.                                                                                                |
| Other registered apps | Six entries remain disconnected starter screens.                                                                                                                                                                                                                                                     | Inventory each actual backend and its operations first. Do not manufacture endpoints or call a placeholder an integration.                                                                                                                                                                      |

## Responsibilities and module boundaries

| Owner               | Responsibilities                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing backend    | Authentication/session, object-level authorization, validation, business rules, persistence, transactions, rate limits and audit records.                  |
| Deployment          | HTTPS, same-origin routing where practical, secrets, allowed origins, health checks, logs, staged rollout and rollback.                                    |
| API contract        | Versioned OpenAPI/schema definitions, operation names, errors, pagination, examples without personal data and compatibility policy.                        |
| SingleUI API module | HTTP, deadlines/cancellation, runtime response validation, DTO translation and typed failures. Lives under `src/api/<capability>`, outside app components. |
| Domain module       | Pure business types/rules that genuinely belong in a client; no Angular, HTTP, theme or translation dependencies.                                          |
| App feature         | Workflow state and focused views. No mailbox passwords, database clients, direct IMAP/SMTP or duplicated server authorization.                             |

Contracts can remain capability-specific. Reuse technical error/pagination
conventions where compatible, not a single enormous cross-domain DTO or client.

## Cross-cutting publication requirements

### Authentication, browser boundary and authorization

Use the existing server-side SSO/session for owned browser apps where possible.
An identity-service login does not automatically grant access to every backend
or every object: validate audience/issuer and per-user capabilities at the
service boundary. Mailbox membership and key ownership are enforced on every
request, not from a client-supplied email or a hidden UI control.

Prefer a same-origin reverse proxy that serves the chosen static app and routes
only its backend/auth paths. Use `Secure`, `HttpOnly` session cookies with an
appropriate `SameSite` policy. State-changing cookie-authenticated requests need
the backend's session-bound CSRF protection and origin checks. Never make GET
mutate business state to avoid CSRF. Mail currently reads `csrf` from form data;
retain that encoding initially rather than inventing an accepted header.

If cross-origin deployment is unavoidable, document exact trusted origins,
credentialed CORS and cookie behavior; do not use `*` with credentials. Never
store long-lived service/API tokens or mailbox passwords in local storage,
bundled configuration, query strings or committed fixtures.

The inspected MailBox pages use `script-src 'none'`. They cannot host Angular
unchanged. Keep that policy on native auth/backend pages; give the static Angular
entry a separately reviewed policy for its own bundles and Angular styles
(nonce-based where needed). Do not disable CSP across the mail host.

### Contract, errors and compatibility

Publish an OpenAPI document alongside the owning backend, with an explicit
version and examples. Treat paths in this plan as draft contracts until the
backend accepts and implements them. Additive compatible changes can remain in
the existing version; breaking changes require a new major contract and a
documented coexistence/deprecation period. Existing Farm and Bridge consumers
must not be broken just to add SingleUI.

New JSON APIs should use consistent statuses: `400` malformed/invalid input,
`401` unauthenticated, `403` unauthorized, `404` unavailable resource,
`409` state conflict, `413` oversized input, `429` throttled, and `5xx`
upstream/service failure. Return machine-readable problem details with a stable
error code, safe field errors and a correlation ID; do not leak credentials,
mail content, stack traces or upstream internals. Native compatibility routes
may retain their existing semantics until explicitly migrated.

Map error codes to localized UI messages. Do not require backend business
content to be translated by shared UI i18n. Locale, timezone, date format and
longer labels must not alter IDs, stored timestamps or numeric request values.

### Data, operations and reliability

Validate both request and response schemas. Bound body sizes, list sizes,
pagination and upstream timeouts. Define stable identifiers and deterministic
ordering; retain existing page-based pagination where needed, and use opaque
cursors for new mutable lists when appropriate. Use UTC timestamps with offsets
in new contracts, without silently rewriting existing raw mail Date headers.

Cancel obsolete UI requests and prevent stale responses from replacing a newer
selection. Retry only safe reads with a bounded policy. Do not automatically
retry commands such as sending mail. Where commands can safely be idempotent,
define server-persisted idempotency-key scope, retention and replay results;
a frontend-generated key alone does not make a command idempotent.

Represent accepted-but-incomplete work honestly. SMTP acceptance is not delivery;
acceptance followed by failure to save a Sent copy must never invite a resend.
Keep drafts on failure and report uncertain outcomes explicitly.

## First vertical slice: MailBox

Build this in the existing MailBox backend, preserving its native routes during
migration. Extract reusable application operations from Flask views rather than
calling view functions or scraping their rendered templates. Both native views
and JSON handlers should call the same bounded operations.

The following paths match the Angular client and coordinated Flask facade, not
evidence that the original deployed Flask application has already been upgraded:

| Method and proposed path                     | Result / behavior                                                                                                                                                                                                                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/mail/session`                      | Public bootstrap: `{ domain, email: string \| null, csrf, oauthConfigured }`; no mailbox credentials. `email: null` means signed out, not a mailbox failure.                                                                                                                            |
| `GET /api/mail/messages?folder=inbox&page=1` | Authenticated `{ messages, more }`; only `inbox`/`sent`, positive page, at most 20 items. Each item: `{ uid, subject, sender, to, date, unread }`. UIDs are scoped by folder.                                                                                                           |
| `GET /api/mail/messages/{uid}?folder=inbox`  | Authenticated summary plus `{ body, attachments: string[] }`. Plain-text rendering only; never inject sender-controlled HTML. Preserve the existing 10 MiB read limit and unsupported-attachment notice.                                                                                |
| `POST /api/mail/compose`                     | Authenticated form data `{ csrf, to, subject, body }`. Preserve one recipient, address validation, 200-character subject, 100,000-character body and five sends/minute/session. Success `{ accepted: true, saved: boolean }` describes SMTP acceptance and Sent-copy status separately. |
| `POST /api/mail/logout`                      | Authenticated form data `{ csrf }`; invalidate server session and return JSON `{ signedOut: true }`.                                                                                                                                                                                    |

All authenticated API routes return JSON `401`, not a redirect followed by an
HTML login page. Keep `/auth/github`, its callback and the existing managed-mailbox
selection server-side for the first release. After successful selection, return
to the Angular entry through a fixed deployment-controlled destination, not an
unvalidated `returnTo` parameter.

An eventual Angular mailbox chooser requires its own proposed capability/list
and selection contracts, with per-request authorization and CSRF. Do not expose
the managed-account secret map or call the existing chooser migrated before that
work is delivered. Attachment downloads and uploads are also out of this slice.

Backend tests must simulate IMAP/SMTP with deterministic fakes, including
send-accepted/Sent-save-failed and ambiguous transport failure. A separate staging
test with dedicated mailboxes verifies actual receipt before claiming end-to-end
sending; fixture browser tests alone do not establish that.

## Rollout and acceptance gates

| Phase                | Deliverable                                                                                                                        | Exit condition                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1. Inventory         | For each service, record source revision, current endpoints, deployment origin, operation/data owners and auth rules.              | Backend owner confirms the inventory; no unresolved assumption is labelled implemented.                                         |
| 2. Agree contract    | Backend-owned OpenAPI/schema change, safe examples, failure semantics and compatibility notes. Start with Mail session/read slice. | Schema and authorization review complete; client/backend tests agree on actual shapes.                                          |
| 3. Publish staging   | Add facade/application operations behind existing session/CSRF; configure same-origin routing.                                     | Signed-out, forbidden-object, invalid-input, timeout and upstream-failure tests pass with safe logs. Native clients still work. |
| 4. Wire SingleUI     | Replace fixture-only tests with contract tests and opt-in live staging journeys; retain visible unavailable states.                | Real login, mailbox selection, list/read and logout work without credentials in browser payloads.                               |
| 5. Enable writes     | Compose and other commands with explicit uncertain/partial-success handling.                                                       | Validation, CSRF, rate-limit, duplicate prevention and receipt checks pass; no unsafe retry.                                    |
| 6. Release gradually | Deploy backend before dependent client; monitor error/latency and capability use.                                                  | Rollback restores previous static entry without reverting data or removing supported backend routes.                            |

For each integration, keep distinct evidence for schema/unit tests, fixture
browser tests, a real staging service and production readiness. Record the tested
service revision, environment, date and limitations without recording secrets.
Native CSS-container checks verify styling only, not business API correctness.

The UI regression gate also checks system light/dark, shared fonts, English and
Vietnamese labels, narrow viewports and component default/hover/pressed/selected/
focus-visible/disabled/loading/error states. A successful request must not leave
focus obscured, unreadable feedback or translated labels clipped.

CI should run contract/schema tests in the owning service and SingleUI client
tests in this repository. Live checks use isolated staging accounts supplied
through runtime secrets, never production data or committed credentials. Start
with Mail, confirm Farm's existing contracts next, then secure Bridge's deployed
path. Add APIs for remaining apps only after identifying real consumer needs.
