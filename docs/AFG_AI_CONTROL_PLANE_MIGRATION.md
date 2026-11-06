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
5. Login throttling is in-memory and resets on process restart. For an internet-facing control plane, add durable or edge-level throttling and audit events.
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
