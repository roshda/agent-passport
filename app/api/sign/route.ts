import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { createConvexClient } from "@/lib/server/convexClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const agentId = typeof body?.agentId === "string" ? body.agentId : "";

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required." }, { status: 400 });
    }

    const convex = createConvexClient();
    const signed = await convex.mutation(anyApi.passports.signAgentPayload, {
      agentId,
      payload: body.payload,
    });

    return NextResponse.json({ signed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sign payload." },
      { status: 500 },
    );
  }
}
