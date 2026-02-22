"use client";

import { useMemo, useState } from "react";

function toSiteUrl(convexUrl: string): string {
  if (!convexUrl) {
    return "";
  }
  if (convexUrl.includes(".convex.cloud")) {
    return convexUrl.replace(".convex.cloud", ".convex.site");
  }
  return convexUrl.replace(/:3210$/, ":3211");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-300 hover:text-cyan-200"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function IntegrationsPage() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? toSiteUrl(convexUrl);

  const appOriginHint = "$APP_ORIGIN";
  const appVerifyPath = "/api/verify";
  const appGatewayIngestPath = "/api/gateway/ingest";
  const liveExamplePath = "/api/integrations/live-example";
  const directConvexVerifyEndpoint = convexSiteUrl ? `${convexSiteUrl}/verifyPassport` : "Not available";

  const liveVerifyCurlSnippet = useMemo(
    () => `APP_ORIGIN=\${APP_ORIGIN:-http://localhost:3000}
EXAMPLE=$(curl -sS -X POST "$APP_ORIGIN${liveExamplePath}")
PAYLOAD=$(echo "$EXAMPLE" | jq -c '.payload')
SIGNATURE=$(echo "$EXAMPLE" | jq -c '.signatureObject')

curl -sS -X POST "$APP_ORIGIN${appVerifyPath}" \\
  -H "Content-Type: application/json" \\
  -d "{\"payload\":$PAYLOAD,\"signatureObject\":$SIGNATURE}" | jq '.'`,
    [appVerifyPath, liveExamplePath],
  );

  const liveGatewayCurlSnippet = useMemo(
    () => `APP_ORIGIN=\${APP_ORIGIN:-http://localhost:3000}
EXAMPLE=$(curl -sS -X POST "$APP_ORIGIN${liveExamplePath}")
PAYLOAD=$(echo "$EXAMPLE" | jq -c '.payload')
SIGNATURE=$(echo "$EXAMPLE" | jq -c '.signatureObject')
REQUEST_ID=$(echo "$PAYLOAD" | jq -r '.requestId')

curl -sS -X POST "$APP_ORIGIN${appGatewayIngestPath}" \\
  -H "Content-Type: application/json" \\
  -d "{\"requestId\":\"$REQUEST_ID\",\"payload\":$PAYLOAD,\"signatureObject\":$SIGNATURE,\"source\":\"gateway-prod\"}" | jq '.'`,
    [appGatewayIngestPath, liveExamplePath],
  );

  return (
    <div className="page-enter space-y-6">
      <section className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Integration Workspace</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Production-facing endpoints and payload contracts for integrating AgentPassport verification into gateways,
          reverse proxies, and API middleware.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">App Verification Endpoint (recommended)</h2>
            <CopyButton text={`${appOriginHint}${appVerifyPath}`} />
          </div>
          <p className="mt-3 rounded-lg bg-slate-900/80 p-3 font-mono text-xs text-cyan-100">
            {appOriginHint}
            {appVerifyPath}
          </p>

          <p className="mt-4 text-sm text-slate-300">
            Working smoke test (generates a real signed payload first):
          </p>
          <div className="mt-2 rounded-xl border border-slate-700/70 bg-slate-900/80 p-3">
            <pre className="overflow-x-auto font-mono text-[11px] text-slate-200">{liveVerifyCurlSnippet}</pre>
          </div>
          <div className="mt-3">
            <CopyButton text={liveVerifyCurlSnippet} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
          <h2 className="text-lg font-semibold text-white">Expected Response</h2>
          <div className="mt-3 rounded-xl border border-slate-700/70 bg-slate-900/80 p-3 font-mono text-[11px] text-slate-200">
            <pre>{`{
  "status": "valid | revoked | invalid",
  "guildName": "Guild Alpha",
  "unlinkable": true,
  "traceableByIssuer": true
}`}</pre>
          </div>

          <div className="mt-4 space-y-2 text-xs text-slate-300">
            <p>Use `status=valid` for allow-list checks and request admission.</p>
            <p>Use `status=revoked` for hard block + incident workflow.</p>
            <p>Use `status=invalid` for generic unauthenticated handling.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Policy + Decision Ingest Endpoint</h2>
          <CopyButton text={`${appOriginHint}${appGatewayIngestPath}`} />
        </div>
        <p className="mt-3 rounded-lg bg-slate-900/80 p-3 font-mono text-xs text-cyan-100">
          {appOriginHint}
          {appGatewayIngestPath}
        </p>
        <p className="mt-3 text-sm text-slate-300">
          This endpoint verifies signatures, applies stored gateway policy, and writes decisions into Convex tables.
        </p>
        <div className="mt-3 rounded-xl border border-slate-700/70 bg-slate-900/80 p-3">
          <pre className="overflow-x-auto font-mono text-[11px] text-slate-200">{liveGatewayCurlSnippet}</pre>
        </div>
        <div className="mt-3">
          <CopyButton text={liveGatewayCurlSnippet} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
        <h2 className="text-lg font-semibold text-white">Direct Convex Verify Endpoint</h2>
        <p className="mt-2 text-xs text-slate-300">Useful for gateway-level integrations that bypass Next.js.</p>
        <p className="mt-3 rounded-lg bg-slate-900/80 p-3 font-mono text-xs text-cyan-100">{directConvexVerifyEndpoint}</p>
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
        <h2 className="text-lg font-semibold text-white">Deployment Variables</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-3">
            <p className="font-mono text-xs text-slate-400">NEXT_PUBLIC_CONVEX_URL</p>
            <p className="mt-1 break-all text-xs text-slate-200">{convexUrl || "Not set"}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-3">
            <p className="font-mono text-xs text-slate-400">NEXT_PUBLIC_CONVEX_SITE_URL</p>
            <p className="mt-1 break-all text-xs text-slate-200">{convexSiteUrl || "Derived at runtime"}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
