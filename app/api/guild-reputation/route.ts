import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { createConvexClient } from "@/lib/server/convexClient";

export async function GET() {
  try {
    const convex = createConvexClient();
    const reputation = await convex.query(anyApi.passports.listGuildReputation, {});
    return NextResponse.json({ reputation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch guild reputation." },
      { status: 500 },
    );
  }
}
