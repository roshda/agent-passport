import { NextResponse } from "next/server";
import { generateAgentAction } from "@/lib/server/simulation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const agentName = typeof body?.agentName === "string" ? body.agentName : "Agent";
    const generated = await generateAgentAction(agentName);

    return NextResponse.json(generated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate action." },
      { status: 500 },
    );
  }
}
