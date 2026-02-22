import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { getConvexSiteUrl } from "@/lib/convexUrls";
import { createConvexClient } from "@/lib/server/convexClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.signatureObject) {
      return NextResponse.json({ error: "signatureObject is required." }, { status: 400 });
    }

    const siteUrl = getConvexSiteUrl();
    const verifyUrl = `${siteUrl}/verifyPassport`;

    try {
      const response = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: body.payload,
          signatureObject: body.signatureObject,
        }),
      });

      if (response.ok) {
        const verified = await response.json();
        return NextResponse.json({
          verified,
          verificationSource: "httpAction",
          endpoint: verifyUrl,
        });
      }
    } catch {
      // Fall through to query fallback.
    }

    const convex = createConvexClient();
    const verified = await convex.query(anyApi.passports.verifyPassportInternal, {
      payload: body.payload,
      signatureObject: body.signatureObject,
    });

    return NextResponse.json({
      verified,
      verificationSource: "queryFallback",
      endpoint: verifyUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify passport." },
      { status: 500 },
    );
  }
}
