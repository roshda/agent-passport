"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentRecord, SignatureObject, VerificationResult } from "@/lib/types";

const DEMO_AGENTS = ["PlannerAgent", "ToolAgent"] as const;

interface AgentRun {
  payload: Record<string, unknown>;
  signatureObject: SignatureObject;
  verification: VerificationResult;
  generationSource: "deterministic";
  verificationSource: string;
  endpoint: string;
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

function statusFor(name: string, agents: AgentRecord[]): AgentRecord | undefined {
  return agents.find((agent) => agent.displayName === name);
}

export default function SimulationPage() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [runs, setRuns] = useState<Record<string, AgentRun | null>>({});
  const [busyAgent, setBusyAgent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    const data = await fetchJson<{ agents: AgentRecord[] }>("/api/agents");
    setAgents(data.agents);
  }, []);

  useEffect(() => {
    loadAgents().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load agents.");
    });
  }, [loadAgents]);

  const ensureAgent = useCallback(
    async (name: string): Promise<string> => {
      const existing = statusFor(name, agents);
      if (existing) {
        return existing.id;
      }

      const created = await fetchJson<{ issued: { agentId: string } }>("/api/agents", {
        method: "POST",
        body: JSON.stringify({ agentName: name }),
      });

      await loadAgents();
      return created.issued.agentId;
    },
    [agents, loadAgents],
  );

  async function createDemoAgents() {
    setError(null);

    try {
      for (const name of DEMO_AGENTS) {
        const existing = statusFor(name, agents);
        if (!existing) {
          await fetchJson("/api/agents", {
            method: "POST",
            body: JSON.stringify({ agentName: name }),
          });
        }
      }

      await loadAgents();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create demo agents.");
    }
  }

  async function revokeAgent(name: string) {
    setError(null);

    try {
      const agent = statusFor(name, agents);
      if (!agent) {
        return;
      }

      await fetchJson(`/api/agents/${agent.id}/revoke`, {
        method: "POST",
      });

      await loadAgents();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Failed to revoke agent.");
    }
  }

  async function runAgent(name: string) {
    setBusyAgent(name);
    setError(null);

    try {
      const agentId = await ensureAgent(name);

      const generated = await fetchJson<{
        payload: Record<string, unknown>;
        source: "deterministic";
      }>("/api/simulate-action", {
        method: "POST",
        body: JSON.stringify({ agentName: name }),
      });

      const signed = await fetchJson<{
        signed: {
          signatureObject: SignatureObject;
        };
      }>("/api/sign", {
        method: "POST",
        body: JSON.stringify({
          agentId,
          payload: generated.payload,
        }),
      });

      const verified = await fetchJson<{
        verified: VerificationResult;
        verificationSource: string;
        endpoint: string;
      }>("/api/verify", {
        method: "POST",
        body: JSON.stringify({
          payload: generated.payload,
          signatureObject: signed.signed.signatureObject,
        }),
      });

      setRuns((current) => ({
        ...current,
        [name]: {
          payload: generated.payload,
          signatureObject: signed.signed.signatureObject,
          verification: verified.verified,
          generationSource: generated.source,
          verificationSource: verified.verificationSource,
          endpoint: verified.endpoint,
        },
      }));

      await loadAgents();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to run simulation.");
    } finally {
      setBusyAgent(null);
    }
  }

  async function reverify(name: string) {
    const run = runs[name];
    if (!run) {
      return;
    }

    setBusyAgent(name);
    setError(null);

    try {
      const verified = await fetchJson<{
        verified: VerificationResult;
        verificationSource: string;
        endpoint: string;
      }>("/api/verify", {
        method: "POST",
        body: JSON.stringify({
          payload: run.payload,
          signatureObject: run.signatureObject,
        }),
      });

      setRuns((current) => ({
        ...current,
        [name]: {
          ...run,
          verification: verified.verified,
          verificationSource: verified.verificationSource,
          endpoint: verified.endpoint,
        },
      }));
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Failed to reverify signature.");
    } finally {
      setBusyAgent(null);
    }
  }

  return (
    <div className="page-enter space-y-6">
      <section className="rounded-3xl border border-white/15 bg-slate-900/65 p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Live Agent Simulation</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Simulate PlannerAgent and ToolAgent generating HTTP signing scenarios aligned to the group-signature paper,
          then signing and verifying through AgentPassport.
        </p>
        <button
          type="button"
          onClick={createDemoAgents}
          className="mt-4 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-200"
        >
          Ensure Demo Agents
        </button>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {DEMO_AGENTS.map((name) => {
          const agent = statusFor(name, agents);
          const run = runs[name];

          return (
            <article key={name} className="rounded-3xl border border-white/15 bg-slate-900/65 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">{name}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    agent?.status === "revoked"
                      ? "bg-rose-500/20 text-rose-200"
                      : "bg-emerald-500/20 text-emerald-200"
                  }`}
                >
                  {agent?.status ?? "not issued"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => runAgent(name)}
                  disabled={busyAgent === name}
                  className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {busyAgent === name ? "Running..." : "Generate + Sign + Verify"}
                </button>
                <button
                  type="button"
                  onClick={() => reverify(name)}
                  disabled={!run || busyAgent === name}
                  className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reverify Last Signature
                </button>
                <button
                  type="button"
                  onClick={() => revokeAgent(name)}
                  disabled={!agent || agent.status === "revoked"}
                  className="rounded-lg border border-rose-300/40 px-3 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Revoke Agent
                </button>
              </div>

              {run ? (
                <div className="mt-4 space-y-2 rounded-2xl border border-white/15 bg-slate-950/50 p-3 text-xs">
                  <p className="font-mono text-cyan-200">Scenario Source: {run.generationSource}</p>
                  <pre className="overflow-x-auto rounded-lg bg-slate-950 p-2 font-mono text-[11px] text-slate-300">
                    {JSON.stringify(run.payload, null, 2)}
                  </pre>
                  <p className="font-mono text-slate-300">verification endpoint: {run.endpoint}</p>
                  <p
                    className={`font-semibold ${
                      run.verification.status === "valid"
                        ? "text-emerald-300"
                        : run.verification.status === "revoked"
                          ? "text-rose-300"
                          : "text-amber-300"
                    }`}
                  >
                    Verification: {run.verification.status.toUpperCase()} ({run.verificationSource})
                  </p>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      {error ? (
        <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      ) : null}
    </div>
  );
}
