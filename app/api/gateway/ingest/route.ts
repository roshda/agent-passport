import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { evaluateRequestsWithPolicy } from "@/lib/gatewayPolicy";
import type { VerificationResult } from "@/lib/types";
import { createConvexClient } from "@/lib/server/convexClient";

function payloadLabel(payload: Record<string, unknown>): string {
  const method = typeof payload.method === "string" ? payload.method : "POST";
  const authority = typeof payload.authority === "string" ? payload.authority : "unknown-api.example";
  const path = typeof payload.path === "string" ? payload.path : "/";
  return `${method} ${authority}${path}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.payload || !body?.signatureObject || !body?.requestId) {
      return NextResponse.json(
        { error: "requestId, payload, and signatureObject are required." },
        { status: 400 },
      );
    }

    const convex = createConvexClient();
    const verification = (await convex.query(anyApi.passports.verifyPassportInternal, {
      payload: body.payload,
      signatureObject: body.signatureObject,
    })) as VerificationResult;

    const policy = await convex.query(anyApi.gateway.getGatewayPolicy, {});
    const evaluated = evaluateRequestsWithPolicy(
      [{ requestId: body.requestId, payload: body.payload, verification }],
      policy,
    )[0];

    await convex.mutation(anyApi.gateway.recordGatewayRequest, {
      requestId: evaluated.requestId,
      payload: evaluated.payload,
      payloadLabel: payloadLabel(evaluated.payload),
      verificationStatus: verification.status,
      guildName: verification.guildName,
      decision: evaluated.decision,
      reason: evaluated.reason,
      source: typeof body?.source === "string" ? body.source : "external_ingest",
    });

    return NextResponse.json({
      verification,
      decision: evaluated.decision,
      reason: evaluated.reason,
      policySnapshot: policy,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to ingest gateway request." },
      { status: 500 },
    );
  }
}
