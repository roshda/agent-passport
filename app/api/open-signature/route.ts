import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { createConvexClient } from "@/lib/server/convexClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.signatureObject) {
      return NextResponse.json({ error: "signatureObject is required." }, { status: 400 });
    }

    const convex = createConvexClient();
    const opened = await convex.query(anyApi.passports.openSignature, {
      signatureObject: body.signatureObject,
    });

    if (!opened) {
      return NextResponse.json({ opened: null }, { status: 404 });
    }

    return NextResponse.json({ opened });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to open signature." },
      { status: 500 },
    );
  }
}
