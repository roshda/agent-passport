# AgentPassport

**Verified AI Agents for API Providers**

AgentPassport turns privacy-preserving group signature concepts into an operational control plane: verify agent traffic, enforce gateway policy, revoke compromised members, and trace abuse when needed.

## Why this framing wins

API providers now receive traffic from:

- Humans
- Scripts
- Unknown AI agents
- Enterprise agent fleets

They need immediate answers:

- Is this a legitimate agent?
- Which guild/organization backs it?
- Has the member been revoked?
- Should this request be allowed, blocked, or rate-limited?

AgentPassport provides that decision layer.

## Documentation

- Comprehensive guide: `docs/COMPREHENSIVE_GUIDE.md`
- Audit report: `docs/AUDIT_REPORT.md`

## Core Product Surface

- Guild-based agent issuance
- Anonymous group-style signing (mock crypto abstraction)
- Public verification endpoint
- Individual revocation
- Issuer traceability (`openSignature`)
- **API Gateway Dashboard** (`/api-gateway`)
  - Persistent incoming request log in Convex
  - Policy enforcement layer stored in Convex
  - Guild reputation score
  - Replayable traffic batch: `3 valid / 1 revoked / 1 invalid`

## Paper-to-Product Mapping

- `issuePassport` -> member onboarding / join
- `signAgentPayload` -> anonymous member signing
- `verifyPassport` -> relying-party verification
- `revokeAgent` -> member revocation
- `openSignature` -> issuer accountability / opening

Crypto is intentionally modular in `convex/cryptoLayer.ts` so real pairing-based signatures can replace the mock layer.

## Stack

- Next.js App Router + Tailwind
- Convex (schema, mutations, queries, HTTP action)
- TypeScript

## Project Layout

- `convex/schema.ts` tables: `guilds`, `agents`, `signatures`
- `convex/passports.ts` identity, verification, revocation, trace logic
- `convex/http.ts` public endpoint `POST /verifyPassport`
- `lib/gatewayPolicy.ts` gateway policy engine
- `app/page.tsx` control-plane overview
- `app/api-gateway/page.tsx` API provider dashboard
- `app/agents/page.tsx` unified agent lifecycle + issuer accountability workspace
- `app/issuer/page.tsx` compatibility redirect to `/agents#signature-audit`
- `app/integrations/page.tsx` integration endpoint docs/snippets
- `app/verify/page.tsx` public verifier utility
- `app/simulate/page.tsx` traffic lab utility

## Two Dashboards (Both Matter)

- App dashboard (`http://localhost:3000`):
  - operator UX
  - gateway policy controls
  - traffic replay and decision analytics
- Convex dashboard (`http://127.0.0.1:6790` in local mode):
  - live backend truth source
  - table-level data inspection
  - function execution logs

Use both in demos: the app shows product workflow, Convex proves real persisted execution.

## Real Data Path

1. Request comes in via `POST /api/gateway/ingest` (or replay batch).
2. Payload signature is verified against guild membership.
3. Stored gateway policy is loaded from Convex.
4. Decision (`allow` / `block` / `rate_limit`) is computed.
5. Decision is persisted to `gatewayRequests`.

Convex tables that should visibly change during demo:

- `agents`
- `signatures`
- `gatewayPolicies`
- `gatewayRequests`

## No External API Keys

No model API keys are required.

Only this env var is needed:

- `NEXT_PUBLIC_CONVEX_URL`

Optional but recommended:

- `NEXT_PUBLIC_CONVEX_SITE_URL`

## Run Locally

1. Install:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env.local
```

3. Start Convex:

```bash
npx convex dev
```

4. Start app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Generate Real Demo Data

Run:

```bash
npm run seed:gateway
```

This executes a real end-to-end pipeline (issue/sign/verify/policy/decision persistence) and writes records into Convex.

## Demo Flow (Judge-Friendly)

1. Open `/api-gateway`.
2. Open Convex dashboard (`http://127.0.0.1:6790`) in a second tab.
3. Click **Replay Traffic Batch**.
4. Show passport verification outcomes (`valid`, `revoked`, `invalid`) and persisted request decisions.
5. In Convex dashboard, show `gatewayRequests` rows being written.
6. Toggle policy controls:
   - allow-list guild
   - block revoked agents
   - per-guild rate limit
7. Click **Apply Policy**, replay again, and show changed decisions.
8. Revoke an agent in `/agents`, replay again, and show hard block behavior.
9. Open a signature in `/agents` (Signature Accountability Audit) to reveal accountable signer.

## Judging Criteria Mapping

1. Novelty & Creativity:
   - privacy-preserving group-signature identity adapted to API gateway governance
   - portable guild reputation derived from verified autonomous traffic
2. Technical Execution:
   - working end-to-end MVP with persistent Convex tables (`gatewayPolicies`, `gatewayRequests`)
   - live ingest endpoint (`/api/gateway/ingest`) and replayable decision pipeline
3. Real-World Impact:
   - solves trust and access control for real API providers facing autonomous traffic
   - supports revocation, accountability, and policy enforcement
4. Demo Clarity:
   - app dashboard for workflow
   - Convex dashboard for backend truth and logs
5. Overall Impression:
   - looks and behaves like an operational control plane, not a standalone crypto toy

## Market Positioning

AgentPassport is:

- Identity + governance middleware for autonomous agent traffic
- API protection layer for marketplaces and gateways
- Portable reputation primitive across organizations
- Foundation for a machine-native Agent Identity Protocol

## Roadmap for Scalability

- Replace mock crypto layer with pairing-based group signatures from the paper.
- Add multi-guild tenancy and enterprise policy namespaces.
- Add gateway-side SDKs (NGINX/Envoy/API Gateway plugins).
- Stream decisions to SIEM/observability pipelines for production compliance.

## Deployment

### Vercel

Set:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL` (recommended for direct HTTP action routing)

### Convex

```bash
npx convex deploy
```

Use the deployed URL as `NEXT_PUBLIC_CONVEX_URL`.

### Live Deployment

- App: `https://passport-six-iota.vercel.app`
- Convex: `https://warmhearted-sardine-352.convex.cloud`
