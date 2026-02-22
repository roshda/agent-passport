import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { evaluateRequestsWithPolicy } from "@/lib/gatewayPolicy";
import type { AgentRecord, SignatureObject, VerificationResult } from "@/lib/types";
import { createConvexClient } from "@/lib/server/convexClient";

interface ReplayEntry {
  requestId: string;
  payload: Record<string, unknown>;
  verification: VerificationResult;
}

function payloadLabel(payload: Record<string, unknown>): string {
  const method = typeof payload.method === "string" ? payload.method : "POST";
  const authority = typeof payload.authority === "string" ? payload.authority : "unknown-api.example";
  const path = typeof payload.path === "string" ? payload.path : "/";
  return `${method} ${authority}${path}`;
}

function mutatePayloadForInvalidRequest(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    ...payload,
    path: `${typeof payload.path === "string" ? payload.path : "/"}?tampered=true`,
  };
}

async function ensureActiveAgent(convex: ReturnType<typeof createConvexClient>, agentName: string) {
  const listed = (await convex.query(anyApi.passports.listAgents, {})) as AgentRecord[];
  const existingActive = listed.find((agent) => agent.displayName === agentName && agent.status === "active");
  if (existingActive) {
    return existingActive.id;
  }

  const issued = await convex.mutation(anyApi.passports.issuePassport, {
    agentName,
  });

  return issued.agentId as string;
}

async function signAndVerify(
  convex: ReturnType<typeof createConvexClient>,
  agentId: string,
  payload: Record<string, unknown>,
) {
  const signed = (await convex.mutation(anyApi.passports.signAgentPayload, {
    agentId,
    payload,
  })) as { signatureObject: SignatureObject };

  const verification = (await convex.query(anyApi.passports.verifyPassportInternal, {
    payload,
    signatureObject: signed.signatureObject,
  })) as VerificationResult;

  return { signatureObject: signed.signatureObject, verification };
}

async function buildRevokedRequest(convex: ReturnType<typeof createConvexClient>): Promise<ReplayEntry> {
  const revokedName = `SuspendedAgent-${Date.now().toString().slice(-5)}`;
  const issued = await convex.mutation(anyApi.passports.issuePassport, { agentName: revokedName });

  const payload = {
    action: "http_message_sign",
    method: "POST",
    authority: "orders-api.example",
    path: "/v1/orders/create",
    contentDigest: "sha-256=:43fa2df11ddf799b08d8c95fd24ef603:",
    requestId: "req-gw-004",
  };

  const signed = (await convex.mutation(anyApi.passports.signAgentPayload, {
    agentId: issued.agentId,
    payload,
  })) as { signatureObject: SignatureObject };

  await convex.mutation(anyApi.passports.revokeAgent, {
    agentId: issued.agentId,
  });

  const verification = (await convex.query(anyApi.passports.verifyPassportInternal, {
    payload,
    signatureObject: signed.signatureObject,
  })) as VerificationResult;

  return {
    requestId: "req-gw-004",
    payload,
    verification,
  };
}

async function buildInvalidRequest(
  convex: ReturnType<typeof createConvexClient>,
  agentId: string,
): Promise<ReplayEntry> {
  const payload = {
    action: "http_message_sign",
    method: "POST",
    authority: "settlement-api.example",
    path: "/v1/settlements/finalize",
    contentDigest: "sha-256=:12957db5f9c695513fbc5ec27ff6f0b2:",
    requestId: "req-gw-005",
  };

  const signed = (await convex.mutation(anyApi.passports.signAgentPayload, {
    agentId,
    payload,
  })) as { signatureObject: SignatureObject };

  const tamperedPayload = mutatePayloadForInvalidRequest(payload);
  const verification = (await convex.query(anyApi.passports.verifyPassportInternal, {
    payload: tamperedPayload,
    signatureObject: signed.signatureObject,
  })) as VerificationResult;

  return {
    requestId: "req-gw-005",
    payload: tamperedPayload,
    verification,
  };
}

export async function POST() {
  try {
    const convex = createConvexClient();

    const plannerId = await ensureActiveAgent(convex, "PlannerAgent");
    const toolId = await ensureActiveAgent(convex, "ToolAgent");

    const validOnePayload = {
      action: "http_message_sign",
      method: "POST",
      authority: "travel-api.example",
      path: "/v1/flights/search",
      contentDigest: "sha-256=:f7f4d8d9d3a4d85ce1766fb4f5f6fa2b:",
      requestId: "req-gw-001",
    };

    const validTwoPayload = {
      action: "http_message_sign",
      method: "GET",
      authority: "weather-api.example",
      path: "/v2/forecast?city=SFO",
      contentDigest: "sha-256=:47deqpj8hbsatf4dztx52en4f0c2v6wz:",
      requestId: "req-gw-002",
    };

    const validThreePayload = {
      action: "http_message_sign",
      method: "POST",
      authority: "hotel-api.example",
      path: "/v1/hotels/quote",
      contentDigest: "sha-256=:f7a37c9f8f391fb5a96a2ea2ac5f8f14:",
      requestId: "req-gw-003",
    };

    const [validOne, validTwo, validThree, revokedOne, invalidOne] = await Promise.all([
      signAndVerify(convex, plannerId, validOnePayload),
      signAndVerify(convex, toolId, validTwoPayload),
      signAndVerify(convex, plannerId, validThreePayload),
      buildRevokedRequest(convex),
      buildInvalidRequest(convex, toolId),
    ]);

    const rawTraffic: ReplayEntry[] = [
      {
        requestId: "req-gw-001",
        payload: validOnePayload,
        verification: validOne.verification,
      },
      {
        requestId: "req-gw-002",
        payload: validTwoPayload,
        verification: validTwo.verification,
      },
      {
        requestId: "req-gw-003",
        payload: validThreePayload,
        verification: validThree.verification,
      },
      revokedOne,
      invalidOne,
    ];

    const policy = await convex.query(anyApi.gateway.getGatewayPolicy, {});
    const evaluated = evaluateRequestsWithPolicy(rawTraffic, policy);

    await Promise.all(
      evaluated.map((entry) =>
        convex.mutation(anyApi.gateway.recordGatewayRequest, {
          requestId: `${entry.requestId}-${Date.now()}`,
          payload: entry.payload,
          payloadLabel: payloadLabel(entry.payload),
          verificationStatus: entry.verification.status,
          guildName: entry.verification.guildName,
          decision: entry.decision,
          reason: entry.reason,
          source: "traffic_replay",
        }),
      ),
    );

    const requests = await convex.query(anyApi.gateway.listGatewayRequests, {
      limit: 50,
    });

    return NextResponse.json({
      replayed: evaluated.length,
      summary: {
        allow: evaluated.filter((entry) => entry.decision === "allow").length,
        block: evaluated.filter((entry) => entry.decision === "block").length,
        rateLimited: evaluated.filter((entry) => entry.decision === "rate_limit").length,
      },
      requests,
      policy,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to replay gateway traffic." },
      { status: 500 },
    );
  }
}
