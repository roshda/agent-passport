import type { VerificationResult } from "@/lib/types";

export type GatewayDecision = "allow" | "block" | "rate_limit";

export interface GatewayPolicy {
  enforceAllowList: boolean;
  allowedGuilds: string[];
  blockRevokedAgents: boolean;
  enforceRateLimit: boolean;
  rateLimitPerGuild: number;
}

export const DEFAULT_GATEWAY_POLICY: GatewayPolicy = {
  enforceAllowList: true,
  allowedGuilds: ["Guild Alpha"],
  blockRevokedAgents: true,
  enforceRateLimit: true,
  rateLimitPerGuild: 2,
};

export interface EvaluatedGatewayRequest {
  requestId: string;
  payload: Record<string, unknown>;
  verification: VerificationResult;
  decision: GatewayDecision;
  reason: string;
}

function guildCounterKey(guildName: string | null): string {
  return guildName ?? "unknown";
}

export function evaluateRequestsWithPolicy(
  requests: Array<{
    requestId: string;
    payload: Record<string, unknown>;
    verification: VerificationResult;
  }>,
  policy: GatewayPolicy,
): EvaluatedGatewayRequest[] {
  const requestsPerGuild = new Map<string, number>();

  return requests.map((request) => {
    const { verification } = request;
    const guildName = verification.guildName;

    if (verification.status === "invalid") {
      return {
        ...request,
        decision: "block" as const,
        reason: "Invalid passport signature.",
      };
    }

    if (verification.status === "revoked" && policy.blockRevokedAgents) {
      return {
        ...request,
        decision: "block" as const,
        reason: "Signer has been revoked by issuer.",
      };
    }

    if (policy.enforceAllowList && guildName && !policy.allowedGuilds.includes(guildName)) {
      return {
        ...request,
        decision: "block" as const,
        reason: "Guild not in allow-list policy.",
      };
    }

    if (policy.enforceAllowList && !guildName) {
      return {
        ...request,
        decision: "block" as const,
        reason: "Guild identity missing for allow-list check.",
      };
    }

    if (policy.enforceRateLimit) {
      const key = guildCounterKey(guildName);
      const current = requestsPerGuild.get(key) ?? 0;
      if (current >= policy.rateLimitPerGuild) {
        return {
          ...request,
          decision: "rate_limit" as const,
          reason: `Exceeded ${policy.rateLimitPerGuild}/batch per-guild gateway limit.`,
        };
      }

      requestsPerGuild.set(key, current + 1);
    }

    return {
      ...request,
      decision: "allow" as const,
      reason: "Request accepted by gateway policy.",
    };
  });
}
