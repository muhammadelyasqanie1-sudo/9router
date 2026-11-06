# AFG AI platform bridge

This integration adds a **read-only** AFG AI operations view to the 9Router Control Plane.

## Required server environment

Configure the same random, high-entropy secret (at least 32 characters) in both services:

- `AFG_AI_9ROUTER_BRIDGE_TOKEN` — shared server-only credential. Never expose it to browser code, URLs, logs, or client bundles.
- On 9Router only, `AFG_AI_ADMIN_API_URL` — the exact HTTPS URL of AFG AI's private endpoint, ending in `/api/internal/9router/overview`.

The AFG AI endpoint is protected by a constant-time comparison of the bearer credential. The 9Router server calls it with redirects disabled, a 12-second timeout, and a 64 KiB response cap. Browser clients call only the authenticated 9Router route `/api/afg-ai/overview`; they never receive the shared credential.

## Permissions

- `afg-ai:read` permits reading aggregate AFG AI platform metrics.
- `afg-ai:manage` is reserved for future mutation endpoints and is not currently used.
- Superadmin retains full access. Staff must be explicitly granted the read scope.

## Current read-only data

The view displays aggregate user counts, today's AI requests/tokens/known cost, 24-hour latency and request errors, provider/model health counts, integration health, and enabled feature flags. It does not return email addresses, user records, provider credentials, keys, or secret configuration.

## Migration boundary

This is the first server-to-server data bridge, not the complete AFG AI admin migration. User/subscription actions, feature-flag mutation, announcements, rate limits, sessions, security events, audit details, error export, and remaining AFG AI-specific settings still need separate scoped endpoints and UI. Keep the existing AFG AI admin backend and database intact until each replacement is implemented and verified.

No live deployment, environment-variable change, build, or test execution is part of this source change. The page remains unavailable until both services are configured and deployed.

## Account management (limited scope)

The bridge also exposes a user list and a restricted status mutation:

- `GET /api/internal/9router/users` — returns at most 250 non-deleted accounts and basic activity fields; requires `afg-ai:users:read`.
- `PATCH /api/internal/9router/users` — accepts only `{ userId, status }`, where status is `active` or `suspended`; requires `afg-ai:users:manage`.
- The AFG AI backend checks the service bearer credential and the server-forwarded 9Router actor claims. The 9Router API route obtains those claims from its authenticated control-plane session and records its own audit event.
- Suspension revokes active AFG AI sessions. The backend prevents self-suspension, protects the last active administrator and superadmin, and prevents staff from changing administrator accounts.

This does not yet support role assignment, account deletion, password resets, or subscription operations.
