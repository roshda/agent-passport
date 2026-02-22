import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { createConvexClient } from "@/lib/server/convexClient";

export async function GET() {
  try {
    const convex = createConvexClient();
    const agents = await convex.query(anyApi.passports.listAgents, {});
    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list agents." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const candidateName =
      typeof body?.agentName === "string"
        ? body.agentName
        : typeof body?.displayName === "string"
          ? body.displayName
          : "";
    const agentName = candidateName.trim();
    if (!agentName) {
      return NextResponse.json({ error: "agentName (or displayName) is required." }, { status: 400 });
    }

    const convex = createConvexClient();
    const issued = await convex.mutation(anyApi.passports.issuePassport, {
      agentName,
    });

    return NextResponse.json({ issued });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to issue passport." },
      { status: 500 },
    );
  }
}
