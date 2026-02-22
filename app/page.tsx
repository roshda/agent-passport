"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentRecord, GuildReputation, GuildSummary, SignatureRecord } from "@/lib/types";

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

export default function HomePage() {
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
  const [reputation, setReputation] = useState<GuildReputation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [guildData, agentsData, signaturesData, reputationData] = await Promise.all([
      fetchJson<{ guild: GuildSummary | null }>("/api/guild"),
      fetchJson<{ agents: AgentRecord[] }>("/api/agents"),
      fetchJson<{ signatures: SignatureRecord[] }>("/api/signatures"),
      fetchJson<{ reputation: GuildReputation[] }>("/api/guild-reputation"),
    ]);

    setGuild(guildData.guild);
    setAgents(agentsData.agents);
    setSignatures(signaturesData.signatures);
    setReputation(reputationData.reputation);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load overview.");
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [load]);

  const metrics = useMemo(
    () => ({
      activeAgents: agents.filter((agent) => agent.status === "active").length,
      revokedAgents: agents.filter((agent) => agent.status === "revoked").length,
      signedRequests: signatures.length,
      trustScore: reputation[0]?.trustScore ?? 100,
    }),
    [agents, reputation, signatures.length],
  );

  return (
    <div className="page-enter space-y-6">
      <section className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6 shadow-2xl shadow-black/40 sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-200">Agent Identity + Governance</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Trust layer for API providers facing autonomous AI traffic.
        </h1>
        <p className="mt-4 max-w-4xl text-slate-300">
          AgentPassport turns privacy-preserving group signature concepts into an operational control plane: verify
          agent traffic, enforce gateway policy, revoke compromised members, and trace abuse when needed.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
            <p className="font-mono text-xs text-slate-400">Active Agents</p>
            <p className="mt-1 text-2xl font-semibold text-white">{metrics.activeAgents}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
            <p className="font-mono text-xs text-slate-400">Revoked Agents</p>
            <p className="mt-1 text-2xl font-semibold text-white">{metrics.revokedAgents}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
            <p className="font-mono text-xs text-slate-400">Signed Requests</p>
            <p className="mt-1 text-2xl font-semibold text-white">{metrics.signedRequests}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
            <p className="font-mono text-xs text-slate-400">Guild Trust Score</p>
            <p className="mt-1 text-2xl font-semibold text-cyan-200">{metrics.trustScore}%</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
          <h2 className="text-xl font-semibold text-white">Operational Modules</h2>
          <p className="mt-2 text-sm text-slate-300">
            This is a deployable product surface, not a cryptography-only demo.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              href="/api-gateway"
              className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 transition hover:border-cyan-300/50"
            >
              <p className="text-sm font-medium text-white">Gateway Decisions</p>
              <p className="mt-1 text-xs text-slate-300">Verify incoming traffic and apply policy actions.</p>
            </Link>
            <Link
              href="/agents"
              className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 transition hover:border-cyan-300/50"
            >
              <p className="text-sm font-medium text-white">Agent Directory</p>
              <p className="mt-1 text-xs text-slate-300">Issue passports, inspect status, and revoke members.</p>
            </Link>
            <Link
              href="/agents#signature-audit"
              className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 transition hover:border-cyan-300/50"
            >
              <p className="text-sm font-medium text-white">Issuer Trace</p>
              <p className="mt-1 text-xs text-slate-300">Open anonymous signatures for accountability workflow.</p>
            </Link>
            <Link
              href="/integrations"
              className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 transition hover:border-cyan-300/50"
            >
              <p className="text-sm font-medium text-white">Integration Docs</p>
              <p className="mt-1 text-xs text-slate-300">Drop-in verify endpoint and implementation snippets.</p>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
          <h2 className="text-xl font-semibold text-white">Deployment Context</h2>
          <p className="mt-2 text-sm text-slate-300">Organization: {guild?.name ?? "Uninitialized"}</p>
          <p className="mt-3 break-all rounded-lg bg-slate-900/70 p-3 font-mono text-xs text-slate-300">
            groupPublicKey: {guild?.groupPublicKey ?? "Issue an agent to initialize guild key material."}
          </p>

          <div className="mt-4 space-y-2 text-xs text-slate-300">
            <p>2026 reality: AI agents are economic actors, but still authenticate like scripts.</p>
            <p>AgentPassport adds machine-native identity, revocation, and policy-ready verification.</p>
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      ) : null}
    </div>
  );
}
