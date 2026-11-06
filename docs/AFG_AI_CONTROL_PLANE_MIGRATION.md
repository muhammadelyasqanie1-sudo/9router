# AFG AI Control Plane — 9Router Integration Audit

Date: 2026-11-06
Target branch: `afg-ai-control-plane`
Upstream baseline: `decolua/9router@1fe586bb1cf35e1ed0cb2150a8ef7d1db040b21d` (v0.5.112)

## Purpose

Make this 9Router instance the authoritative management plane for AFG AI while keeping AFG AI as the end-user chat/application frontend. The AFG AI admin UI is to be retired only after equivalent server-side management, identity, authorization, audit, and operational capabilities exist in 9Router.

## Repository verification

- This repository is a fork of `decolua/9router`.
- Fork `master` compares identical to upstream `master` at the checked baseline (0 commits ahead, 0 behind).
- The app package reports version `0.5.112`.
- The active Railway service is still configured from the Docker image `decolua/9router:latest`, not from this Git repository.
- Production data is mounted at `/app/data`. Preserve this volume and take a verified backup before any source switch or migration.

## Current 9Router architecture observed

- Next.js dashboard and OpenAI-compatible gateway in one process.
- Management API routes under `src/app/api/*`; inference endpoints under `/v1/*`.
- Dashboard and management state persisted in SQLite through `src/lib/db/*`.
- Provider connections, provider nodes, proxy pools, API keys, model combos/aliases, pricing, settings, usage history, and request details are represented in the local database.
- Usage and request-detail records currently belong to this 9Router instance; they are not a multi-tenant AFG AI user/organization ledger.
- Dashboard auth is a single shared password-backed JWT session. It is not yet a staff/user RBAC control plane.

## Security findings to address before exposing it as AFG AI's admin plane

1. `src/dashboardGuard.js` permits management API access when `settings.requireLogin === false`. AFG AI's management plane must enforce authentication regardless of this legacy preference.
2. Dashboard login currently issues a generic authenticated session; there are no first-class AFG AI roles, scoped staff permissions, or tenant boundaries.
3. The public allow-list includes operational endpoints such as health/init/version/auth flows; review every route and keep only intentionally public endpoints.
4. Management APIs share one global dashboard identity. Add explicit role/scope authorization for sensitive operations, not only a hidden dashboard link.
5. The original login throttling was in-memory and reset on process restart. The current branch adds durable SQLite lockout state; edge/distributed throttling is still needed if multiple independent router instances are exposed behind one load balancer.
6. Audit logging for privileged configuration changes must be durable and attributable to a user/staff identity.
7. Provider credentials and user-level usage must remain server-side. Never expose upstream provider secrets or admin credentials to the AFG AI browser client.

## Target ownership model

- 9Router owns provider credentials, provider health, model catalog/routing, combos/fallback, API gateway keys, request logs, usage metering, quota/rate limits, staff access, admin audit, and operational configuration.
- AFG AI owns end-user chat UX, conversations/messages, profiles, app preferences, uploads/images, and end-user session UX.
- AFG AI calls 9Router only through authenticated server-to-server APIs. Browser clients never receive 9Router master credentials.
- Resend transactional email remains in AFG AI.
- APInex and Tavily integrations must be preserved during the migration; Gemini must not become the default provider.
- Existing AFG AI admin endpoints/tables are retired domain-by-domain only after a verified replacement and data migration exist.

## Migration sequence

### Phase 0 — Baseline and backup (current)
- Pin the upstream baseline and create this isolated branch.
- Inventory every management route, database repository/table, and AFG AI admin domain.
- Record the live Railway configuration and preserve the existing `/app/data` volume.
- Do not deploy or alter the production service during this phase.

### Phase 1 — Identity and authorization
- Define AFG AI administrator, superadministrator, and scoped staff roles.
- Implement server-side sessions/identity mapping and role/scope checks.
- Force authentication on all management surfaces, even if legacy `requireLogin` is disabled.
- Add CSRF/origin protections to cookie-authenticated mutation endpoints.
- Add durable audit events for login, role changes, provider changes, routing changes, secrets/config changes, and destructive actions.

### Phase 2 — Management APIs and data ownership
- Build versioned, authenticated control-plane APIs for AFG AI.
- Map AFG AI admin domains to 9Router data and APIs, adding schema/migrations where necessary.
- Add explicit tenant/app identifiers and actor IDs to usage/audit records where required.
- Define export/import, idempotency, rollback, and reconciliation for each migrated domain.

### Phase 3 — AFG AI integration
- Replace AFG AI's old admin panel with one authorized "Management access" entry.
- Use a server-side status/redirect endpoint; open only the configured HTTPS dashboard after server-side role validation.
- Keep the 9Router master secret on the server only.
- Preserve AFG AI user-facing features and non-admin APIs.

### Phase 4 — Cutover
- Back up and verify the existing Railway volume.
- Deploy the pinned fork from GitHub to a staging service first.
- Verify login, roles, providers, APInex, Tavily, model routing, streaming, usage, logs, quotas, backups, and rollback.
- Only then schedule production source switch while retaining the same volume mount and a known-good image rollback.
- Remove old AFG AI admin APIs/tables only after domain-by-domain reconciliation and explicit cutover verification.

## Phase 1 implementation checkpoint (branch only)

The following foundational controls are now implemented on `afg-ai-control-plane`:

- Additive SQLite tables for `controlPlaneUsers` and `controlPlaneAudit`; `SCHEMA_VERSION` is incremented so existing databases take the migration runner's pre-schema backup before additive table sync.
- Individual staff sign-in by email/password, bcrypt password hashes, 12-character minimum for newly created/changed staff passwords, and per-login account-active checks.
- Existing dashboard master-password login remains a break-glass `superadmin` path in control-plane mode. A default-password first login from a remote client remains blocked by the upstream safety check.
- JWTs for staff carry only the account ID and token version; current role, active state, and permissions are re-read from SQLite on requests. Disable, password reset, role change, or permission change increments token version and revokes existing staff sessions.
- Server-side path/method permission mapping for management APIs. Unknown management routes are privileged by default. Inference endpoints retain their separate existing API-key authentication.
- Initial CSRF defense: cookie-authenticated state-changing requests in control-plane mode must include a matching Origin or Referer; cross-site Fetch Metadata is rejected.
- Superadministrator-only APIs to create, list, update, and disable staff/admin accounts; owner superadmin cannot be created or modified through these APIs.
- Read-only audit API and durable audit records for successful staff/owner logins and staff account creation, changes, and disablement.
- Login page supports optional staff email; leaving it blank uses the owner break-glass credential.
- Local-only routes remain subject to their upstream local-peer restriction before the control-plane role check.

### Remaining before Phase 1 can be considered complete

- The visible account/role/audit screen is available at `/dashboard/admin/users` and is linked in the sidebar for the owner superadministrator.
- Extend durable audit instrumentation to provider, routing, quota, security, integration, and other privileged mutations.
- A same-origin check is now enforced in control-plane mode for state-changing requests carrying the dashboard auth cookie; cross-site Fetch Metadata is rejected. This is an initial middleware guard, not a substitute for route-level review, reverse-proxy verification, or tests.
- Review all legacy public allow-list entries and verify the origin guard against the deployed proxy/origin configuration.
- Decide and implement identity mapping for OIDC/SAML; those providers must not silently acquire elevated roles.
- Persistent per-instance SQLite login throttling is now implemented on the follow-up branch; add shared edge/distributed throttling before horizontally scaling and document owner recovery/credential rotation procedures.
- Review every management API's required scope and verify the mapping against its actual HTTP methods.
- Run static checks, tests, and staging deployment only after authorization to do so; none were run in this work.

## Route authorization audit checkpoint (2026-11-06)

Static inventory was performed against the merged master tree at 6d4c4eacc9b7f62bf59afb2247754a5b3c905bb8. It found 177 Next.js API route handlers. This is a source-tree inventory, not a runtime penetration test or a claim that every handler's internal authorization has been independently verified.

- The 24 /api/v1 and /api/v1beta handlers are covered by the public inference-prefix gate and retain their own API-key authentication.
- The existing domain prefixes cover provider, routing, usage, settings, integration, system, and control-plane admin APIs. Unrecognized management routes fail closed to system:manage.
- Fifteen route paths are outside the explicit domain-prefix map and therefore rely on that fail-closed fallback: /api/auth/reset-password; seven /api/headroom/* paths; and eight /api/pxpipe/* paths. The reset-password route and selected headroom operations also have local-only restrictions. These routes should receive explicit domain scopes only after their handlers and intended operators are reviewed.
- Legacy public auth prefixes include OIDC/SAML entry routes, but the stricter control-plane public allow-list currently permits only login/logout/status. OIDC/SAML flows therefore remain unavailable in control-plane mode until identity mapping, state/nonce validation, callback handling, and role assignment are implemented. Do not add them to the public allow-list as a shortcut.
- /api/settings/database originally matched the broad settings prefix before the system prefix. Its GET exports the full database, including provider credentials, and POST replaces the database. The permission mapper now explicitly requires system:manage for both methods before evaluating broader prefixes.

A focused unit test file, tests/unit/control-plane-access.test.js, covers the database export/import scope, ordinary settings scopes, audit scopes, and fail-closed fallback. It was added but has NOT been executed. The route inventory and this focused fix do not replace full method-by-method review of all 177 handlers.

### Remaining route/authentication work

- Review each route handler's own authorization and side effects, including API routes that perform a second password check or accept CLI-token headers.
- Decide whether headroom and pxpipe operations need dedicated scopes and/or local-only restrictions; retain the current fail-closed system:manage behavior until that review is complete.
- Implement safe OIDC/SAML identity mapping before enabling those login flows in control-plane mode.
- Add shared edge/distributed login throttling before horizontally scaling; the branch-level SQLite limiter persists across restarts of one instance.

## Persistent login throttling and database-owner guard (branch checkpoint)

- Schema version is incremented to 4 and adds a SQLite loginRateLimits table with an indexed lastFailAt field. The migration is additive and follows the existing pre-schema backup path.
- Dashboard login lockout state now uses an atomic SQLite UPSERT, survives process restarts, preserves progressive lock durations (30 seconds, 2 minutes, 10 minutes, 30 minutes), resets the failure count after each lock, and clears the bucket after a successful login.
- Only a SHA-256 digest of the IP bucket is stored; raw IP values are not persisted in the limiter table. The existing trusted-peer / TRUST_PROXY source selection remains in place.
- Expired buckets are pruned during failed-login traffic; active locks are retained. Direct deployments without a trusted peer still share the existing 'unknown' bucket, preserving the anti-spoofing behavior.
- Login route calls now await the database-backed limiter. Tests were added for lockout, successful reset, and persistence across adapter reinitialization, but were NOT executed.
- Follow-up review found that system:manage can be granted to scoped staff, so that permission alone was not sufficient to guarantee owner-only database export/import. The control-plane middleware now additionally requires actor.role === superadmin for /api/settings/database and descendants. A focused classification test was added but not run.

### Remaining verification

- Run the new and existing auth/database migration tests in CI or an authorized staging environment; validate adapter behavior on every supported SQLite driver.
- Confirm schema-version backup/restore behavior on a copy of a real existing database before production rollout.
- Review reverse-proxy origin configuration and trusted peer IP handling before enabling control-plane mode on the live Railway service.
- This branch is not deployed. The Railway Docker image and persistent /app/data volume remain unchanged.

## Acceptance criteria

- No unauthenticated or role-ineligible access to dashboard or management APIs.
- Superadministrator and scoped staff permissions are enforced by the server.
- AFG AI browser never receives 9Router master credentials.
- APInex and Tavily continue working; Gemini is not silently selected as default.
- Existing provider credentials, API keys, aliases, combos, usage history, and request details survive migration.
- Backups can be restored and rollback is documented.
- No fake admin UI, mock metrics, or success states without real backend operations.

## Explicit non-actions

No tests, builds, deployments, production variable changes, Railway source changes, volume edits, or data deletion were performed as part of this audit.
