import { ConvexHttpClient } from "convex/browser";
import { getConvexUrl } from "@/lib/convexUrls";

export function createConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(getConvexUrl());
}
