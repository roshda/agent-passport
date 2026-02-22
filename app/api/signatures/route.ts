import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { createConvexClient } from "@/lib/server/convexClient";

export async function GET() {
  try {
    const convex = createConvexClient();
    const signatures = await convex.query(anyApi.passports.listSignatures, {});
    return NextResponse.json({ signatures });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list signatures." },
      { status: 500 },
    );
  }
}
