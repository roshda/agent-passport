import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import type { AgentRecord, SignatureObject, VerificationResult } from "@/lib/types";
import { generateAgentAction } from "@/lib/server/simulation";
import { createConvexClient } from "@/lib/server/convexClient";

function withUniqueRequestId(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    ...payload,
    requestId: `live-${Date.now().toString(36)}`,
  };
}

async function ensurePlannerAgent(convex: ReturnType<typeof createConvexClient>): Promise<{ id: string; name: string }> {
  const agents = (await convex.query(anyApi.passports.listAgents, {})) as AgentRecord[];
  const existing = agents.find((agent) => agent.displayName === "PlannerAgent" && agent.status === "active");
  if (existing) {
    return { id: existing.id, name: existing.displayName };
  }

  const issued = await convex.mutation(anyApi.passports.issuePassport, {
    agentName: "PlannerAgent",
  });

  return { id: String(issued.agentId), name: "PlannerAgent" };
}

export async function POST() {
  try {
    const convex = createConvexClient();
    const planner = await ensurePlannerAgent(convex);
    const generated = await generateAgentAction(planner.name);
    const payload = withUniqueRequestId(generated.payload);

    const signed = (await convex.mutation(anyApi.passports.signAgentPayload, {
      agentId: planner.id,
      payload,
    })) as { signatureObject: SignatureObject };

    const verification = (await convex.query(anyApi.passports.verifyPassportInternal, {
      payload,
      signatureObject: signed.signatureObject,
    })) as VerificationResult;

    return NextResponse.json({
      agent: {
        id: planner.id,
        displayName: planner.name,
      },
      payload,
      signatureObject: signed.signatureObject,
      verification,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate live integration example.",
      },
      { status: 500 },
    );
  }
}
