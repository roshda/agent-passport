"use client";

import { useMemo, useState } from "react";
import type { SignatureObject, VerificationResult } from "@/lib/types";

const samplePayload = {
  action: "book_flight",
  destination: "SFO",
  budget: 500,
};

const sampleSignatureObject: SignatureObject = {
  payloadHash: "",
  signature: "",
  timestamp: Date.now(),
  groupId: "",
};

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

export default function VerifyPage() {
  const [payloadInput, setPayloadInput] = useState(JSON.stringify(samplePayload, null, 2));
  const [signatureInput, setSignatureInput] = useState(
    JSON.stringify(sampleSignatureObject, null, 2),
  );
  const [result, setResult] = useState<{
    verified: VerificationResult;
    verificationSource: string;
    endpoint: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const statusLabel = useMemo(() => {
    if (!result) {
      return null;
    }

    if (result.verified.status === "valid") {
      return "🛂 Valid Passport";
    }
    if (result.verified.status === "revoked") {
      return "🚫 Revoked";
    }
    return "⚠️ Invalid";
  }, [result]);

  async function verify() {
    setBusy(true);
    setError(null);

    try {
      const payload = JSON.parse(payloadInput);
      const signatureObject = JSON.parse(signatureInput) as SignatureObject;

      const verified = await fetchJson<{
        verified: VerificationResult;
        verificationSource: string;
        endpoint: string;
      }>("/api/verify", {
        method: "POST",
        body: JSON.stringify({ payload, signatureObject }),
      });

      setResult(verified);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Verification failed.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-enter space-y-6">
      <section className="rounded-3xl border border-white/15 bg-slate-900/65 p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Public Verification</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Submit a signed HTTP-style payload and verify whether the paper-inspired group signature resolves to valid,
          revoked, or invalid.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/15 bg-slate-900/65 p-5">
          <p className="text-sm font-medium text-white">Payload JSON</p>
          <textarea
            value={payloadInput}
            onChange={(event) => setPayloadInput(event.target.value)}
            className="mt-2 h-64 w-full rounded-xl border border-white/20 bg-slate-950/70 p-3 font-mono text-xs text-slate-200 outline-none focus:border-cyan-300"
          />
        </div>

        <div className="rounded-3xl border border-white/15 bg-slate-900/65 p-5">
          <p className="text-sm font-medium text-white">Signature JSON</p>
          <textarea
            value={signatureInput}
            onChange={(event) => setSignatureInput(event.target.value)}
            className="mt-2 h-64 w-full rounded-xl border border-white/20 bg-slate-950/70 p-3 font-mono text-xs text-slate-200 outline-none focus:border-cyan-300"
          />
        </div>
      </section>

      <button
        type="button"
        onClick={verify}
        disabled={busy}
        className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Verifying..." : "Verify Passport"}
      </button>

      {statusLabel && result ? (
        <section className="rounded-3xl border border-white/15 bg-slate-900/65 p-5">
          <p
            className={`text-xl font-semibold ${
              result.verified.status === "valid"
                ? "text-emerald-300"
                : result.verified.status === "revoked"
                  ? "text-rose-300"
                  : "text-amber-300"
            }`}
          >
            {statusLabel}
          </p>
          <p className="mt-3 text-sm text-slate-300">Guild: {result.verified.guildName ?? "Unknown"}</p>
          <p className="text-sm text-slate-300">Unlinkable: {String(result.verified.unlinkable)}</p>
          <p className="text-sm text-slate-300">Traceable by issuer: {String(result.verified.traceableByIssuer)}</p>
          <p className="mt-3 font-mono text-xs text-slate-400">Endpoint: {result.endpoint}</p>
          <p className="font-mono text-xs text-slate-400">Source: {result.verificationSource}</p>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      ) : null}
    </div>
  );
}
