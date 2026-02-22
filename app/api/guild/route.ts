import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { createConvexClient } from "@/lib/server/convexClient";

export async function GET() {
  try {
    const convex = createConvexClient();
    const guild = await convex.query(anyApi.passports.getGuild, {});
    return NextResponse.json({ guild });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch guild." },
      { status: 500 },
    );
  }
}
