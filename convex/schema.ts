import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  guilds: defineTable({
    name: v.string(),
    groupPublicKey: v.string(),
    issuerSecret: v.string(),
  }).index("by_name", ["name"]),

  agents: defineTable({
    guildId: v.id("guilds"),
    displayName: v.string(),
    memberSecret: v.string(),
    status: v.union(v.literal("active"), v.literal("revoked")),
    createdAt: v.number(),
  })
    .index("by_guild", ["guildId"])
    .index("by_status", ["status"]),

  signatures: defineTable({
    agentId: v.id("agents"),
    payloadHash: v.string(),
    signature: v.string(),
    timestamp: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_timestamp", ["timestamp"]),

  gatewayPolicies: defineTable({
    policyKey: v.string(),
    enforceAllowList: v.boolean(),
    allowedGuilds: v.array(v.string()),
    blockRevokedAgents: v.boolean(),
    enforceRateLimit: v.boolean(),
    rateLimitPerGuild: v.number(),
    updatedAt: v.number(),
  }).index("by_policy_key", ["policyKey"]),

  gatewayRequests: defineTable({
    requestId: v.string(),
    payload: v.any(),
    payloadLabel: v.string(),
    verificationStatus: v.union(v.literal("valid"), v.literal("revoked"), v.literal("invalid")),
    guildName: v.union(v.string(), v.null()),
    decision: v.union(v.literal("allow"), v.literal("block"), v.literal("rate_limit")),
    reason: v.string(),
    source: v.string(),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_request_id", ["requestId"]),
});
