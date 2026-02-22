"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GatewayPolicy } from "@/lib/gatewayPolicy";
import { DEFAULT_GATEWAY_POLICY } from "@/lib/gatewayPolicy";
import type { GatewayRequestRecord, GuildReputation } from "@/lib/types";

interface StoredPolicy extends GatewayPolicy {
  policyKey: string;
  updatedAt: number;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Request failed.");
  }

  return data as T;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function convexLocalDashboardUrl(): string | null {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return null;
  }

  if (convexUrl.includes("127.0.0.1:3210")) {
    return "http://127.0.0.1:6790";
  }

  return null;
}

export default function ApiGatewayPage() {
  const [policy, setPolicy] = useState<StoredPolicy>({
    policyKey: "default",
    ...DEFAULT_GATEWAY_POLICY,
    updatedAt: Date.now(),
  });
  const [requests, setRequests] = useState<GatewayRequestRecord[]>([]);
  const [reputation, setReputation] = useState<GuildReputation[]>([]);

  const [busyReplay, setBusyReplay] = useState(false);
  const [busyPolicy, setBusyPolicy] = useState(false);
  const [busyClear, setBusyClear] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dashboardUrl = convexLocalDashboardUrl();

  const loadAll = useCallback(async () => {
    const [policyData, requestsData, reputationData] = await Promise.all([
      fetchJson<{ policy: StoredPolicy }>("/api/gateway/policy"),
      fetchJson<{ requests: GatewayRequestRecord[] }>("/api/gateway/requests?limit=100"),
      fetchJson<{ reputation: GuildReputation[] }>("/api/guild-reputation"),
    ]);

    setPolicy(policyData.policy);
    setRequests(requestsData.requests);
    setReputation(reputationData.reputation);
  }, []);

  useEffect(() => {
    loadAll().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load gateway data.");
    });
  }, [loadAll]);

  const summary = useMemo(
    () => ({
      allow: requests.filter((entry) => entry.decision === "allow").length,
      block: requests.filter((entry) => entry.decision === "block").length,
      rateLimited: requests.filter((entry) => entry.decision === "rate_limit").length,
    }),
    [requests],
  );

  async function applyPolicy() {
    setBusyPolicy(true);
    setError(null);

    try {
      const payload = await fetchJson<{ policy: StoredPolicy }>("/api/gateway/policy", {
        method: "POST",
        body: JSON.stringify(policy),
      });

      setPolicy(payload.policy);
    } catch (policyError) {
      setError(policyError instanceof Error ? policyError.message : "Failed to apply gateway policy.");
    } finally {
      setBusyPolicy(false);
    }
  }

  async function replayTrafficBatch() {
    setBusyReplay(true);
    setError(null);

    try {
      await fetchJson("/api/gateway/replay", {
        method: "POST",
      });
      await loadAll();
    } catch (replayError) {
      setError(replayError instanceof Error ? replayError.message : "Failed to replay traffic batch.");
    } finally {
      setBusyReplay(false);
    }
  }

  async function clearHistory() {
    setBusyClear(true);
    setError(null);

    try {
      await fetchJson("/api/gateway/clear", {
        method: "POST",
      });
      await loadAll();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Failed to clear request history.");
    } finally {
      setBusyClear(false);
    }
  }

  const selectedGuild = policy.allowedGuilds[0] ?? "";

  return (
    <div className="page-enter space-y-6">
      <section className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-200">API Provider Operations</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Gateway Decision Engine
        </h1>
        <p className="mt-3 max-w-4xl text-slate-300">
          Real request decisions are persisted in Convex. Replay batches to generate traffic, tune policy, and inspect
          historical allow/block/rate-limit outcomes.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={replayTrafficBatch}
            disabled={busyReplay}
            className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busyReplay ? "Replaying..." : "Replay Traffic Batch"}
          </button>
          <button
            type="button"
            onClick={clearHistory}
            disabled={busyClear}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-rose-300 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busyClear ? "Clearing..." : "Clear Request History"}
          </button>
          {dashboardUrl ? (
            <a
              href={dashboardUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-300 hover:text-cyan-200"
            >
              Open Convex Dashboard
            </a>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
        <h2 className="text-xl font-semibold text-white">Policy Configuration</h2>
        <p className="mt-2 text-sm text-slate-300">
          Policy is persisted in Convex and applied to every ingested gateway request.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3 text-xs text-slate-300">
            <span className="font-medium text-white">Allow-list Guild</span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={policy.enforceAllowList}
                onChange={(event) =>
                  setPolicy((current) => ({
                    ...current,
                    enforceAllowList: event.target.checked,
                  }))
                }
              />
              <span>Enforce</span>
            </div>
            <select
              value={selectedGuild}
              onChange={(event) =>
                setPolicy((current) => ({
                  ...current,
                  allowedGuilds: event.target.value ? [event.target.value] : [],
                }))
              }
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white"
              disabled={reputation.length === 0}
            >
              {reputation.length === 0 ? <option value="">No guilds</option> : null}
              {reputation.map((entry) => (
                <option key={entry.guildId} value={entry.guildName}>
                  {entry.guildName}
                </option>
              ))}
            </select>
          </label>

          <label className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3 text-xs text-slate-300">
            <span className="font-medium text-white">Revocation Block</span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={policy.blockRevokedAgents}
                onChange={(event) =>
                  setPolicy((current) => ({
                    ...current,
                    blockRevokedAgents: event.target.checked,
                  }))
                }
              />
              <span>Block revoked signers</span>
            </div>
          </label>

          <label className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3 text-xs text-slate-300">
            <span className="font-medium text-white">Per-Guild Rate Limit</span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={policy.enforceRateLimit}
                onChange={(event) =>
                  setPolicy((current) => ({
                    ...current,
                    enforceRateLimit: event.target.checked,
                  }))
                }
              />
              <span>Enforce</span>
            </div>
            <input
              type="number"
              min={1}
              max={20}
              value={policy.rateLimitPerGuild}
              onChange={(event) =>
                setPolicy((current) => ({
                  ...current,
                  rateLimitPerGuild: Math.max(1, Number(event.target.value) || 1),
                }))
              }
              className="mt-2 w-24 rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white"
            />
          </label>

          <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3 text-xs text-slate-300">
            <p className="font-medium text-white">Last Updated</p>
            <p className="mt-2">{formatTimestamp(policy.updatedAt)}</p>
            <button
              type="button"
              onClick={applyPolicy}
              disabled={busyPolicy}
              className="mt-3 rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busyPolicy ? "Applying..." : "Apply Policy"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4">
          <p className="font-mono text-xs text-emerald-200">ALLOW</p>
          <p className="mt-1 text-2xl font-semibold text-white">{summary.allow}</p>
        </div>
        <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 p-4">
          <p className="font-mono text-xs text-rose-200">BLOCK</p>
          <p className="mt-1 text-2xl font-semibold text-white">{summary.block}</p>
        </div>
        <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-4">
          <p className="font-mono text-xs text-amber-200">RATE_LIMIT</p>
          <p className="mt-1 text-2xl font-semibold text-white">{summary.rateLimited}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/60">
        <div className="border-b border-slate-700/70 p-5">
          <h2 className="text-xl font-semibold text-white">Gateway Request Log</h2>
          <p className="mt-1 text-sm text-slate-300">
            Persisted in Convex table `gatewayRequests` and visible in the Convex dashboard.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Guild</th>
                <th className="px-4 py-3">Passport</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-400" colSpan={7}>
                    No gateway traffic recorded yet.
                  </td>
                </tr>
              ) : (
                requests.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-700/60 text-slate-200">
                    <td className="px-4 py-3 text-xs">{formatTimestamp(entry.timestamp)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{entry.payloadLabel}</td>
                    <td className="px-4 py-3 text-xs">{entry.guildName ?? "Unknown"}</td>
                    <td className="px-4 py-3 text-xs">{entry.verificationStatus}</td>
                    <td className="px-4 py-3 text-xs">{entry.decision}</td>
                    <td className="px-4 py-3 text-xs">{entry.source}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{entry.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
        <h2 className="text-lg font-semibold text-white">External Ingest Endpoint</h2>
        <p className="mt-2 text-sm text-slate-300">
          Use `POST /api/gateway/ingest` to submit live request + signature pairs from real gateway middleware.
        </p>
      </section>

      {error ? (
        <p className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      ) : null}
    </div>
  );
}
