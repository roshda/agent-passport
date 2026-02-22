export function getConvexUrl(): string {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set.");
  }
  return convexUrl;
}

export function toConvexSiteUrl(convexUrl: string): string {
  if (convexUrl.includes(".convex.cloud")) {
    return convexUrl.replace(".convex.cloud", ".convex.site");
  }

  if (convexUrl.includes(":3210")) {
    return convexUrl.replace(":3210", ":3211");
  }

  return convexUrl.replace("127.0.0.1", "localhost");
}

export function getConvexSiteUrl(): string {
  const explicitSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (explicitSiteUrl) {
    return explicitSiteUrl;
  }

  return toConvexSiteUrl(getConvexUrl());
}
