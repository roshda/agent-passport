"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentRecord, GuildSummary, SignatureRecord } from "@/lib/types";

interface OpenedSignature {
  agentId: string;
  displayName: string;
  status: "active" | "revoked";
  guildName: string;
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

export default function AgentsPage() {
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);

  const [agentName, setAgentName] = useState("PlannerAgent");
  const [busyMutation, setBusyMutation] = useState(false);
  const [busyOpenId, setBusyOpenId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [issuedSecret, setIssuedSecret] = useState<{ agentId: string; memberSecret: string } | null>(null);
  const [openResults, setOpenResults] = useState<Record<string, OpenedSignature | null>>({});

  const load = useCallback(async () => {
    const [guildData, agentsData, signaturesData] = await Promise.all([
      fetchJson<{ guild: GuildSummary | null }>("/api/guild"),
      fetchJson<{ agents: AgentRecord[] }>("/api/agents"),
      fetchJson<{ signatures: SignatureRecord[] }>("/api/signatures"),
    ]);

    setGuild(guildData.guild);
    setAgents(agentsData.agents);
    setSignatures(signaturesData.signatures);
  }, []);

  useEffect(() => {
    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load agent operations.");
    });
  }, [load]);

  const counts = useMemo(
    () => ({
      active: agents.filter((agent) => agent.status === "active").length,
      revoked: agents.filter((agent) => agent.status === "revoked").length,
    }),
    [agents],
  );

  async function issuePassport() {
    setBusyMutation(true);
    setError(null);

    try {
      const payload = await fetchJson<{
        issued: {
          agentId: string;
          memberSecret: string;
        };
      }>("/api/agents", {
        method: "POST",
        body: JSON.stringify({ agentName }),
      });

      setIssuedSecret(payload.issued);
      await load();
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : "Failed to issue passport.");
    } finally {
      setBusyMutation(false);
    }
  }

  async function revoke(agentId: string) {
    setBusyMutation(true);
    setError(null);

    try {
      await fetchJson(`/api/agents/${agentId}/revoke`, {
        method: "POST",
      });

      await load();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Failed to revoke agent.");
    } finally {
      setBusyMutation(false);
    }
  }

  async function openSignature(signature: SignatureRecord) {
    setBusyOpenId(signature.id);
    setError(null);

    try {
      const response = await fetch("/api/open-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureObject: signature.signatureObject,
        }),
      });

      if (response.status === 404) {
        setOpenResults((current) => ({
          ...current,
          [signature.id]: null,
        }));
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Open signature failed.");
      }

      setOpenResults((current) => ({
        ...current,
        [signature.id]: data.opened,
      }));
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Failed to open signature.");
    } finally {
      setBusyOpenId(null);
    }
  }

  return (
    <div className="page-enter space-y-6">
      <section className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Agent Operations</h1>
        <p className="mt-2 text-sm text-slate-300">
          Unified workspace for identity lifecycle (issue/revoke) and issuer accountability (open signatures).
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
            <p className="font-mono text-xs text-slate-400">Guild</p>
            <p className="mt-1 text-sm font-medium text-white">{guild?.name ?? "Not initialized"}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
            <p className="font-mono text-xs text-slate-400">Active</p>
            <p className="mt-1 text-sm font-medium text-white">{counts.active}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
            <p className="font-mono text-xs text-slate-400">Revoked</p>
            <p className="mt-1 text-sm font-medium text-white">{counts.revoked}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1.3fr]">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
          <h2 className="text-lg font-semibold text-white">Issue Passport</h2>
          <p className="mt-2 text-sm text-slate-300">Create a new agent identity under the guild issuer.</p>

          <div className="mt-4 flex flex-col gap-3">
            <input
              value={agentName}
              onChange={(event) => setAgentName(event.target.value)}
              placeholder="Agent display name"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300"
            />
            <button
              type="button"
              onClick={issuePassport}
              disabled={busyMutation || !agentName.trim()}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyMutation ? "Issuing..." : "Issue Passport"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {["PlannerAgent", "ToolAgent", "OpsAgent"].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setAgentName(name)}
                className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300 transition hover:border-cyan-300 hover:text-cyan-200"
              >
                {name}
              </button>
            ))}
          </div>

          {issuedSecret ? (
            <div className="mt-4 rounded-xl border border-cyan-300/40 bg-cyan-500/10 p-3 font-mono text-xs text-cyan-100">
              <p className="text-cyan-200">Issued credentials</p>
              <p className="mt-1 break-all">agentId: {issuedSecret.agentId}</p>
              <p className="mt-1 break-all">memberSecret: {issuedSecret.memberSecret}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
          <h2 className="text-lg font-semibold text-white">Current Members</h2>
          <div className="mt-4 space-y-3">
            {agents.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-600 p-3 text-sm text-slate-400">
                No agents issued yet.
              </p>
            ) : (
              agents.map((agent) => (
                <div key={agent.id} className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{agent.displayName}</p>
                      <p className="mt-1 font-mono text-[11px] text-slate-400">{agent.id}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        agent.status === "active"
                          ? "bg-emerald-500/20 text-emerald-200"
                          : "bg-rose-500/20 text-rose-200"
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => revoke(agent.id)}
                    disabled={busyMutation || agent.status === "revoked"}
                    className="mt-3 rounded-lg border border-rose-300/40 px-3 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Revoke Agent
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section id="signature-audit" className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-6">
        <h2 className="text-xl font-semibold text-white">Signature Accountability Audit</h2>
        <p className="mt-2 text-sm text-slate-300">
          Open anonymous signatures to reveal responsible members when investigating misuse.
        </p>

        <div className="mt-4 space-y-3">
          {signatures.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-600 p-3 text-sm text-slate-400">
              No signatures logged yet.
            </p>
          ) : (
            signatures.map((entry) => {
              const openResult = openResults[entry.id];

              return (
                <article key={entry.id} className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">hash: {entry.payloadHash.slice(0, 18)}...</p>
                      <p className="mt-1 font-mono text-[11px] text-slate-400">
                        signature: {entry.signature.slice(0, 28)}...
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        signer status: <span className="font-semibold">{entry.agentStatus}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openSignature(entry)}
                      disabled={busyOpenId === entry.id}
                      className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyOpenId === entry.id ? "Opening..." : "Open Signature"}
                    </button>
                  </div>

                  {openResult ? (
                    <div className="mt-3 rounded-lg border border-cyan-200/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                      <p>Agent: {openResult.displayName}</p>
                      <p className="font-mono">agentId: {openResult.agentId}</p>
                      <p>Status: {openResult.status}</p>
                      <p>Guild: {openResult.guildName}</p>
                    </div>
                  ) : openResult === null ? (
                    <p className="mt-3 rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                      Signature could not be opened.
                    </p>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      ) : null}
    </div>
  );
}
