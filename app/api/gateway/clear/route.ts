import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { createConvexClient } from "@/lib/server/convexClient";

export async function POST() {
  try {
    const convex = createConvexClient();
    const result = await convex.mutation(anyApi.gateway.clearGatewayRequests, {});
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear gateway requests." },
      { status: 500 },
    );
  }
}
