import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { DEFAULT_GATEWAY_POLICY } from "@/lib/gatewayPolicy";
import { createConvexClient } from "@/lib/server/convexClient";

export async function GET() {
  try {
    const convex = createConvexClient();
    const policy = await convex.query(anyApi.gateway.getGatewayPolicy, {});
    return NextResponse.json({ policy });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load gateway policy.",
        policy: {
          policyKey: "default",
          ...DEFAULT_GATEWAY_POLICY,
          updatedAt: Date.now(),
        },
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const convex = createConvexClient();
    const policy = await convex.mutation(anyApi.gateway.setGatewayPolicy, {
      enforceAllowList: Boolean(body?.enforceAllowList),
      allowedGuilds: Array.isArray(body?.allowedGuilds)
        ? body.allowedGuilds.filter((value: unknown): value is string => typeof value === "string")
        : [],
      blockRevokedAgents: Boolean(body?.blockRevokedAgents),
      enforceRateLimit: Boolean(body?.enforceRateLimit),
      rateLimitPerGuild:
        typeof body?.rateLimitPerGuild === "number" && body.rateLimitPerGuild > 0
          ? Math.floor(body.rateLimitPerGuild)
          : 1,
    });

    return NextResponse.json({ policy });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update gateway policy." },
      { status: 500 },
    );
  }
}
