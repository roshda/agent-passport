import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";

const DEFAULT_POLICY_KEY = "default";

function defaultPolicy() {
  return {
    enforceAllowList: true,
    allowedGuilds: ["Guild Alpha"],
    blockRevokedAgents: true,
    enforceRateLimit: true,
    rateLimitPerGuild: 2,
  };
}

export const getGatewayPolicy = query({
  args: {},
  returns: v.object({
    policyKey: v.string(),
    enforceAllowList: v.boolean(),
    allowedGuilds: v.array(v.string()),
    blockRevokedAgents: v.boolean(),
    enforceRateLimit: v.boolean(),
    rateLimitPerGuild: v.number(),
    updatedAt: v.number(),
  }),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("gatewayPolicies")
      .withIndex("by_policy_key", (q) => q.eq("policyKey", DEFAULT_POLICY_KEY))
      .unique();

    if (existing) {
      return {
        policyKey: existing.policyKey,
        enforceAllowList: existing.enforceAllowList,
        allowedGuilds: existing.allowedGuilds,
        blockRevokedAgents: existing.blockRevokedAgents,
        enforceRateLimit: existing.enforceRateLimit,
        rateLimitPerGuild: existing.rateLimitPerGuild,
        updatedAt: existing.updatedAt,
      };
    }

    const defaults = defaultPolicy();
    return {
      policyKey: DEFAULT_POLICY_KEY,
      enforceAllowList: defaults.enforceAllowList,
      allowedGuilds: defaults.allowedGuilds,
      blockRevokedAgents: defaults.blockRevokedAgents,
      enforceRateLimit: defaults.enforceRateLimit,
      rateLimitPerGuild: defaults.rateLimitPerGuild,
      updatedAt: 0,
    };
  },
});

export const setGatewayPolicy = mutation({
  args: {
    enforceAllowList: v.boolean(),
    allowedGuilds: v.array(v.string()),
    blockRevokedAgents: v.boolean(),
    enforceRateLimit: v.boolean(),
    rateLimitPerGuild: v.number(),
  },
  returns: v.object({
    policyKey: v.string(),
    enforceAllowList: v.boolean(),
    allowedGuilds: v.array(v.string()),
    blockRevokedAgents: v.boolean(),
    enforceRateLimit: v.boolean(),
    rateLimitPerGuild: v.number(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gatewayPolicies")
      .withIndex("by_policy_key", (q) => q.eq("policyKey", DEFAULT_POLICY_KEY))
      .unique();

    const updatedAt = Date.now();
    const payload = {
      enforceAllowList: args.enforceAllowList,
      allowedGuilds: args.allowedGuilds,
      blockRevokedAgents: args.blockRevokedAgents,
      enforceRateLimit: args.enforceRateLimit,
      rateLimitPerGuild: args.rateLimitPerGuild,
      updatedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return {
        policyKey: DEFAULT_POLICY_KEY,
        ...payload,
      };
    }

    await ctx.db.insert("gatewayPolicies", {
      policyKey: DEFAULT_POLICY_KEY,
      ...payload,
    });

    return {
      policyKey: DEFAULT_POLICY_KEY,
      ...payload,
    };
  },
});

export const recordGatewayRequest = mutation({
  args: {
    requestId: v.string(),
    payload: v.any(),
    payloadLabel: v.string(),
    verificationStatus: v.union(v.literal("valid"), v.literal("revoked"), v.literal("invalid")),
    guildName: v.union(v.string(), v.null()),
    decision: v.union(v.literal("allow"), v.literal("block"), v.literal("rate_limit")),
    reason: v.string(),
    source: v.string(),
    timestamp: v.optional(v.number()),
  },
  returns: v.object({
    id: v.id("gatewayRequests"),
  }),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("gatewayRequests", {
      requestId: args.requestId,
      payload: args.payload,
      payloadLabel: args.payloadLabel,
      verificationStatus: args.verificationStatus,
      guildName: args.guildName,
      decision: args.decision,
      reason: args.reason,
      source: args.source,
      timestamp: args.timestamp ?? Date.now(),
    });

    return { id };
  },
});

export const listGatewayRequests = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id("gatewayRequests"),
      requestId: v.string(),
      payload: v.any(),
      payloadLabel: v.string(),
      verificationStatus: v.union(v.literal("valid"), v.literal("revoked"), v.literal("invalid")),
      guildName: v.union(v.string(), v.null()),
      decision: v.union(v.literal("allow"), v.literal("block"), v.literal("rate_limit")),
      reason: v.string(),
      source: v.string(),
      timestamp: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const rows = await ctx.db
      .query("gatewayRequests")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      id: row._id,
      requestId: row.requestId,
      payload: row.payload,
      payloadLabel: row.payloadLabel,
      verificationStatus: row.verificationStatus,
      guildName: row.guildName,
      decision: row.decision,
      reason: row.reason,
      source: row.source,
      timestamp: row.timestamp,
    }));
  },
});

export const clearGatewayRequests = mutation({
  args: {},
  returns: v.object({
    deleted: v.number(),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("gatewayRequests").collect();
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    return { deleted: rows.length };
  },
});
