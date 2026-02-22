# AgentPassport Audit Report

Date: 2026-02-22
Scope: Full MVP audit across architecture, runtime behavior, endpoint contracts, data persistence, UX flow integrity, and deployment readiness.

## Audit Method

1. Static review of key modules (`convex/*`, `app/api/*`, `app/*`, `lib/*`).
2. Build and lint gates.
3. End-to-end smoke tests against running local services:
   - `http://localhost:3000` (Next.js app)
   - `http://127.0.0.1:3210` / `http://127.0.0.1:3211` (Convex local backend + site)
4. Flow validation for issue/sign/verify/revoke/open + gateway policy/ingest/replay.

## Executed Checks

- `npm run lint` -> PASS
- `npm run build` -> PASS
- API smoke tests -> PASS
  - `POST /api/agents` (both `agentName` and `displayName` payloads)
  - `POST /api/sign`
  - `POST /api/verify`
  - `POST /api/agents/:agentId/revoke`
  - `POST /api/open-signature`
  - `GET/POST /api/gateway/policy`
  - `POST /api/gateway/ingest`
  - `POST /api/gateway/replay`
  - `GET /api/gateway/requests`
  - `POST /api/integrations/live-example`

## Findings Resolved During Audit

1. Convex verify endpoint URL resolution issue
- Impact: `/api/verify` could fall back unnecessarily instead of using Convex HTTP action in local/dev.
- Fix:
  - `lib/convexUrls.ts` now:
    - honors `NEXT_PUBLIC_CONVEX_SITE_URL` when set,
    - derives `:3211` from local `:3210` automatically,
    - keeps cloud URL conversion (`.convex.cloud` -> `.convex.site`).
- Result: verification now reports `verificationSource: "httpAction"` with endpoint `http://127.0.0.1:3211/verifyPassport` in local mode.

2. Agent issuance payload contract too strict
- Impact: integrations sending `displayName` would fail because API required `agentName` only.
- Fix:
  - `app/api/agents/route.ts` now accepts both `agentName` and `displayName`.
- Result: backward-compatible contract and fewer integration breakages.

3. Integration examples not directly runnable
- Impact: docs required manual placeholder replacement for signatures/hashes, leading to “example endpoint not working” perception.
- Fix:
  - Added `POST /api/integrations/live-example` to generate real signed payload + signature object + verification.
  - Updated `app/integrations/page.tsx` to provide copyable, runnable smoke-test snippets based on live generated data.
- Result: integration page now supports real command execution without manual signature assembly.

4. Issuer UX duplication confusion
- Impact: separate issuer surface felt redundant after merging flows.
- Fix:
  - Home card now links directly to `/agents#signature-audit`.
  - `/issuer` remains as compatibility redirect.
- Result: clearer single operator workspace for lifecycle + accountability.

## Current Risk Register (Open)

1. Crypto is mocked (High, accepted for MVP)
- Current layer uses SHA-256 + HMAC abstraction.
- Production path requires replacing `convex/cryptoLayer.ts` with pairing-based group signatures from the paper.

2. Single-guild default model (Medium)
- MVP initializes and operates around default guild (`Guild Alpha`).
- Multi-tenant issuer model is roadmap work.

3. Issuer authorization not enforced (High)
- `openSignature` endpoint is functionally issuer-like but lacks hardened authN/authZ controls.
- Production requires role-based auth and audit logging controls.

4. Anti-replay semantics are limited (Medium)
- Verification validates signature integrity but does not enforce TTL/nonce/replay cache.
- Production should add timestamp window, nonce registry, and signed HTTP canonicalization checks.

5. Gateway rate-limit logic is batch-oriented (Medium)
- Policy currently applies per evaluation batch, not distributed sliding-window rate limiting.
- Production needs durable counters + window semantics per guild.

## Finalization Status

- Product flows: finalized for MVP demo.
- UI framing: positioned as API-provider trust/governance product, not a cryptography toy.
- Data persistence: real Convex-backed records across all core operations.
- Deployment readiness: app is build-clean and deployed.
  - Vercel: `https://passport-six-iota.vercel.app`
  - Convex: `https://warmhearted-sardine-352.convex.cloud`
  - Convex HTTP actions: `https://warmhearted-sardine-352.convex.site`
