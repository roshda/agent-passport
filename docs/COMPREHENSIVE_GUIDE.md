# AgentPassport Comprehensive Guide

## 1) Executive Summary

AgentPassport is a deployable MVP for machine-native identity and trust in autonomous agent ecosystems.

Product framing:
- Not “just group signatures.”
- It is an **API gateway trust layer** for identifying, governing, and auditing AI agent traffic.

Core value:
- Verify whether incoming traffic is backed by a known guild.
- Preserve agent-level unlinkability at verification time.
- Keep issuer accountability and targeted revocation when abuse happens.

This repo is intentionally built as a marketable wrapper around:
- `Privacy-Preserving Group Signatures for HTTP Message Signing`

while using a modular mock crypto layer so the MVP remains runnable without specialized cryptographic infrastructure.

## 2) Problem Context (Why This Exists)

Autonomous agents now execute workflows, call APIs, and transact at machine speed.
Most systems still authenticate agents as if they were scripts:
- static API keys
- shared OAuth tokens
- per-agent key sprawl

This creates four systemic failures:
1. Identity does not scale across large agent fleets.
2. Persistent identifiers reduce privacy and increase cross-service tracking.
3. Revocation is operationally expensive (global key churn).
4. Accountability is weak when credentials are shared.

AgentPassport addresses the tension:
- **privacy-preserving verification** for relying parties,
- **traceability and revocation** for issuers,
- **policy-ready decisions** for gateways and marketplaces.

## 3) Product Positioning

AgentPassport is positioned as:
- Identity + governance middleware for autonomous AI traffic.
- Verification layer for API providers and agent marketplaces.
- A bridge from legacy API-key auth toward machine-native identity standards.

Judge/VC narrative:
- In 2026, AI agents are economic actors.
- Infrastructure cannot treat them like anonymous scripts.
- AgentPassport is the control plane for trusted autonomous traffic.

## 4) What Is Actually Built (Working MVP)

### Identity and crypto primitives
- Guild issuer model.
- Agent passport issuance.
- Payload signing.
- Public verification.
- Targeted agent revocation.
- Issuer opening of signatures for accountability.

### API provider operations layer
- Gateway policy engine (allow-list / revoked block / rate-limit).
- Persistent gateway decision log.
- Replay batch with mixed traffic (`valid`, `revoked`, `invalid`).
- Guild trust/reputation scoring.

### Product UI surfaces
- `/` Overview control-plane landing.
- `/api-gateway` Provider dashboard with policy + live decision logs.
- `/agents` Unified agent lifecycle + signature accountability audit.
- `/verify` Public verifier utility.
- `/integrations` Integration-ready endpoint workspace with runnable commands.
- `/simulate` Agent workflow lab.

## 5) Architecture

### Frontend
- Next.js App Router
- Tailwind CSS
- Deployable to Vercel

### Backend/Governance
- Convex schema + queries + mutations + HTTP action
- Convex acts as source of truth and operational state store

### Crypto abstraction
- `convex/cryptoLayer.ts`
- Current implementation:
  - `payloadHash = SHA-256(stableCanonicalPayload)`
  - `signature = HMAC(memberSecret, payloadHash)`
- Interface is modular so real group signature implementation can replace internals later.

## 6) Data Model

Defined in `convex/schema.ts`.

### `guilds`
- `name`
- `groupPublicKey`
- `issuerSecret`

### `agents`
- `guildId`
- `displayName`
- `memberSecret`
- `status` (`active` | `revoked`)
- `createdAt`

### `signatures`
- `agentId`
- `payloadHash`
- `signature`
- `timestamp`

### `gatewayPolicies`
- `policyKey`
- `enforceAllowList`
- `allowedGuilds`
- `blockRevokedAgents`
- `enforceRateLimit`
- `rateLimitPerGuild`
- `updatedAt`

### `gatewayRequests`
- `requestId`
- `payload`
- `payloadLabel`
- `verificationStatus`
- `guildName`
- `decision`
- `reason`
- `source`
- `timestamp`

## 7) Core Runtime Flows

### A) Issue passport
- `POST /api/agents`
- Accepts `agentName` or `displayName`.
- Creates active member in guild.

### B) Sign payload
- `POST /api/sign`
- Uses agent member secret via Convex mutation.
- Stores signature event in `signatures`.

### C) Verify passport
- `POST /api/verify`
- Primary path: Convex HTTP action (`/verifyPassport`).
- Returns:
  - `valid`
  - `revoked`
  - `invalid`

### D) Revoke
- `POST /api/agents/:agentId/revoke`
- Future verification for prior signatures returns revoked status.

### E) Open signature
- `POST /api/open-signature`
- Resolves signer identity for issuer accountability workflow.

### F) Gateway decisioning
- `POST /api/gateway/ingest`
- Verifies signature, applies stored policy, persists decision to `gatewayRequests`.

### G) Demo traffic replay
- `POST /api/gateway/replay`
- Generates mixed traffic and writes decision records for dashboard demo.

## 8) Integration UX (Now Truly Runnable)

To avoid “placeholder docs,” a live example endpoint exists:
- `POST /api/integrations/live-example`

It returns:
- real payload
- real signatureObject
- real verification result

This allows integration snippets to run end-to-end with no manual signature construction.

## 9) Two Dashboards and Why Both Matter

### Product dashboard (Next.js)
- URL: `http://localhost:3000`
- Purpose: operator workflows and policy controls.

### Convex dashboard (local)
- URL: `http://127.0.0.1:6790`
- Purpose: backend proof of persistence and execution logs.

For judges:
- The app demonstrates usability.
- Convex demonstrates technical reality.

## 10) Environment Variables

### Required
- `NEXT_PUBLIC_CONVEX_URL`
  - Local example: `http://127.0.0.1:3210`
  - Cloud example: `https://<deployment>.convex.cloud`

### Optional (recommended)
- `NEXT_PUBLIC_CONVEX_SITE_URL`
  - Local example: `http://127.0.0.1:3211`
  - Cloud example: `https://<deployment>.convex.site`

No external model API keys are required for this MVP.

## 11) Local Setup

```bash
npm install
npx convex dev
npm run dev
```

Optional seed:
```bash
npm run seed:gateway
```

## 12) Demo Runbook (Judge-Friendly)

1. Open `/api-gateway` and Convex dashboard side-by-side.
2. Replay traffic batch.
3. Show mixed verification outcomes and policy decisions in gateway log.
4. Switch to `/agents` and revoke an agent.
5. Replay traffic again and show policy auto-block behavior.
6. Open signature in the accountability section to reveal signer.
7. Use `/integrations` runnable snippets to prove external integration path.

Expected punchline:
- This is identity + governance + accountability in one pipeline.

## 13) Judging Criteria Mapping

### Novelty & Creativity
- Privacy-preserving identity concepts adapted into gateway policy and marketplace trust workflows.

### Technical Execution
- Working full-stack MVP with persisted operational data and callable APIs.

### Real-World Impact
- Directly applicable to API providers receiving autonomous agent traffic.

### Demo Clarity
- Clear operator workflow + backend truth dashboard + replayable scenarios.

### Overall Impression
- Presented as an operational control plane, not a cryptography-only toy.

## 14) Scalability Story (Roadmap)

1. Replace mock crypto with real pairing-based group signatures from the paper.
2. Add multi-guild tenant isolation and enterprise policy namespaces.
3. Ship gateway SDKs/plugins (Envoy, NGINX, API Gateway adapters).
4. Add replay protection (nonce/TTL) and security policy controls.
5. Add observability export to SIEM and compliance pipelines.
6. Standardize payload contract toward an Agent Identity Protocol.

## 15) Known MVP Limits

- Current cryptography is simulation-grade (interface-compatible, not paper-complete).
- Issuer operations are not behind hardened authN/authZ yet.
- Rate limiting is policy-evaluation batch based (not distributed temporal counters).

These are deliberate MVP tradeoffs to maximize shipping speed and demo clarity.

## 16) Deployment (Vercel + Convex)

### Convex production
```bash
npx convex deploy
```
Capture generated cloud URL(s).

### Vercel
```bash
npx vercel
npx vercel --prod
```
Set env vars in Vercel project settings:
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL` (optional but recommended)

Then redeploy.

### Current deployed instance (this workspace)
- App: `https://passport-six-iota.vercel.app`
- Convex cloud: `https://warmhearted-sardine-352.convex.cloud`
- Convex HTTP actions: `https://warmhearted-sardine-352.convex.site`

## 17) Short Pitch Script

"API providers are overwhelmed by autonomous traffic. AgentPassport lets them verify whether a request comes from a trusted agent guild, apply policy in real time, revoke bad actors without rotating everyone, and still preserve privacy until issuer-level accountability is required."
