import fs from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const index = line.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function payloadLabel(payload) {
  const method = typeof payload.method === "string" ? payload.method : "POST";
  const authority = typeof payload.authority === "string" ? payload.authority : "unknown-api.example";
  const pathName = typeof payload.path === "string" ? payload.path : "/";
  return `${method} ${authority}${pathName}`;
}

function evaluateRequestsWithPolicy(requests, policy) {
  const requestsPerGuild = new Map();

  return requests.map((request) => {
    const verification = request.verification;
    const guildName = verification.guildName;

    if (verification.status === "invalid") {
      return {
        ...request,
        decision: "block",
        reason: "Invalid passport signature.",
      };
    }

    if (verification.status === "revoked" && policy.blockRevokedAgents) {
      return {
        ...request,
        decision: "block",
        reason: "Signer has been revoked by issuer.",
      };
    }

    if (policy.enforceAllowList && guildName && !policy.allowedGuilds.includes(guildName)) {
      return {
        ...request,
        decision: "block",
        reason: "Guild not in allow-list policy.",
      };
    }

    if (policy.enforceAllowList && !guildName) {
      return {
        ...request,
        decision: "block",
        reason: "Guild identity missing for allow-list check.",
      };
    }

    if (policy.enforceRateLimit) {
      const key = guildName ?? "unknown";
      const current = requestsPerGuild.get(key) ?? 0;
      if (current >= policy.rateLimitPerGuild) {
        return {
          ...request,
          decision: "rate_limit",
          reason: `Exceeded ${policy.rateLimitPerGuild}/batch per-guild gateway limit.`,
        };
      }
      requestsPerGuild.set(key, current + 1);
    }

    return {
      ...request,
      decision: "allow",
      reason: "Request accepted by gateway policy.",
    };
  });
}

function mutatePayloadForInvalidRequest(payload) {
  return {
    ...payload,
    path: `${typeof payload.path === "string" ? payload.path : "/"}?tampered=true`,
  };
}

async function ensureActiveAgent(convex, agentName) {
  const listed = await convex.query(anyApi.passports.listAgents, {});
  const existing = listed.find((agent) => agent.displayName === agentName && agent.status === "active");
  if (existing) {
    return existing.id;
  }

  const issued = await convex.mutation(anyApi.passports.issuePassport, { agentName });
  return issued.agentId;
}

async function signAndVerify(convex, agentId, payload) {
  const signed = await convex.mutation(anyApi.passports.signAgentPayload, { agentId, payload });
  const verification = await convex.query(anyApi.passports.verifyPassportInternal, {
    payload,
    signatureObject: signed.signatureObject,
  });
  return { signatureObject: signed.signatureObject, verification };
}

async function buildRevokedRequest(convex) {
  const issued = await convex.mutation(anyApi.passports.issuePassport, {
    agentName: `SuspendedAgent-${Date.now().toString().slice(-5)}`,
  });

  const payload = {
    action: "http_message_sign",
    method: "POST",
    authority: "orders-api.example",
    path: "/v1/orders/create",
    contentDigest: "sha-256=:43fa2df11ddf799b08d8c95fd24ef603:",
    requestId: "seed-gw-004",
  };

  const signed = await convex.mutation(anyApi.passports.signAgentPayload, {
    agentId: issued.agentId,
    payload,
  });

  await convex.mutation(anyApi.passports.revokeAgent, {
    agentId: issued.agentId,
  });

  const verification = await convex.query(anyApi.passports.verifyPassportInternal, {
    payload,
    signatureObject: signed.signatureObject,
  });

  return {
    requestId: "seed-gw-004",
    payload,
    verification,
  };
}

async function buildInvalidRequest(convex, agentId) {
  const payload = {
    action: "http_message_sign",
    method: "POST",
    authority: "settlement-api.example",
    path: "/v1/settlements/finalize",
    contentDigest: "sha-256=:12957db5f9c695513fbc5ec27ff6f0b2:",
    requestId: "seed-gw-005",
  };

  const signed = await convex.mutation(anyApi.passports.signAgentPayload, {
    agentId,
    payload,
  });

  const tampered = mutatePayloadForInvalidRequest(payload);
  const verification = await convex.query(anyApi.passports.verifyPassportInternal, {
    payload: tampered,
    signatureObject: signed.signatureObject,
  });

  return {
    requestId: "seed-gw-005",
    payload: tampered,
    verification,
  };
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is missing. Run `npx convex dev` first.");
  }

  const convex = new ConvexHttpClient(convexUrl);

  await convex.mutation(anyApi.gateway.clearGatewayRequests, {});

  const plannerId = await ensureActiveAgent(convex, "PlannerAgent");
  const toolId = await ensureActiveAgent(convex, "ToolAgent");

  const validOnePayload = {
    action: "http_message_sign",
    method: "POST",
    authority: "travel-api.example",
    path: "/v1/flights/search",
    contentDigest: "sha-256=:f7f4d8d9d3a4d85ce1766fb4f5f6fa2b:",
    requestId: "seed-gw-001",
  };

  const validTwoPayload = {
    action: "http_message_sign",
    method: "GET",
    authority: "weather-api.example",
    path: "/v2/forecast?city=SFO",
    contentDigest: "sha-256=:47deqpj8hbsatf4dztx52en4f0c2v6wz:",
    requestId: "seed-gw-002",
  };

  const validThreePayload = {
    action: "http_message_sign",
    method: "POST",
    authority: "hotel-api.example",
    path: "/v1/hotels/quote",
    contentDigest: "sha-256=:f7a37c9f8f391fb5a96a2ea2ac5f8f14:",
    requestId: "seed-gw-003",
  };

  const [validOne, validTwo, validThree, revokedOne, invalidOne] = await Promise.all([
    signAndVerify(convex, plannerId, validOnePayload),
    signAndVerify(convex, toolId, validTwoPayload),
    signAndVerify(convex, plannerId, validThreePayload),
    buildRevokedRequest(convex),
    buildInvalidRequest(convex, toolId),
  ]);

  const rawTraffic = [
    {
      requestId: "seed-gw-001",
      payload: validOnePayload,
      verification: validOne.verification,
    },
    {
      requestId: "seed-gw-002",
      payload: validTwoPayload,
      verification: validTwo.verification,
    },
    {
      requestId: "seed-gw-003",
      payload: validThreePayload,
      verification: validThree.verification,
    },
    revokedOne,
    invalidOne,
  ];

  const policy = await convex.query(anyApi.gateway.getGatewayPolicy, {});
  const evaluated = evaluateRequestsWithPolicy(rawTraffic, policy);

  await Promise.all(
    evaluated.map((entry) =>
      convex.mutation(anyApi.gateway.recordGatewayRequest, {
        requestId: `${entry.requestId}-${Date.now()}`,
        payload: entry.payload,
        payloadLabel: payloadLabel(entry.payload),
        verificationStatus: entry.verification.status,
        guildName: entry.verification.guildName,
        decision: entry.decision,
        reason: entry.reason,
        source: "seed_script",
      }),
    ),
  );

  const all = await convex.query(anyApi.gateway.listGatewayRequests, { limit: 50 });

  const allow = all.filter((entry) => entry.decision === "allow").length;
  const block = all.filter((entry) => entry.decision === "block").length;
  const rateLimit = all.filter((entry) => entry.decision === "rate_limit").length;

  console.log(`Seeded gateway data to ${convexUrl}`);
  console.log(`Requests in log: ${all.length}`);
  console.log(`Summary -> allow: ${allow}, block: ${block}, rate_limit: ${rateLimit}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
