import {
  anyApi,
  httpActionGeneric as httpAction,
  mutationGeneric as mutation,
  queryGeneric as query,
} from "convex/server";
import { type GenericId, v } from "convex/values";
import {
  deriveSignatureFromHash,
  signPayload,
  verifySignature,
  type SignatureObject,
} from "./cryptoLayer";

const DEFAULT_GUILD_NAME = "Guild Alpha";

const signatureObjectValidator = v.object({
  payloadHash: v.string(),
  signature: v.string(),
  timestamp: v.number(),
  groupId: v.string(),
});

type GuildRecord = {
  _id: GenericId<"guilds">;
  name: string;
  groupPublicKey: string;
  issuerSecret: string;
};

type GuildDatabase = {
  query: (table: "guilds") => {
    withIndex: (
      index: "by_name",
      predicate: (q: { eq: (field: "name", value: string) => unknown }) => unknown,
    ) => {
      unique: () => Promise<GuildRecord | null>;
    };
  };
  insert: (table: "guilds", value: Omit<GuildRecord, "_id">) => Promise<GenericId<"guilds">>;
  get: (id: GenericId<"guilds">) => Promise<GuildRecord | null>;
};

function randomSecret(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function guildDb(ctx: { db: unknown }): GuildDatabase {
  return ctx.db as GuildDatabase;
}

async function getDefaultGuild(ctx: { db: unknown }): Promise<GuildRecord | null> {
  return guildDb(ctx)
    .query("guilds")
    .withIndex("by_name", (q) => q.eq("name", DEFAULT_GUILD_NAME))
    .unique();
}

async function getOrCreateDefaultGuild(ctx: { db: unknown }): Promise<GuildRecord | null> {
  const db = guildDb(ctx);
  const existingGuild = await getDefaultGuild(ctx);
  if (existingGuild) {
    return existingGuild;
  }

  const guildId = await db.insert("guilds", {
    name: DEFAULT_GUILD_NAME,
    groupPublicKey: randomSecret(48),
    issuerSecret: randomSecret(48),
  });

  return db.get(guildId);
}

function makeVerificationResponse(status: "valid" | "revoked" | "invalid", guildName: string | null) {
  return {
    status,
    guildName,
    unlinkable: true,
    traceableByIssuer: true,
  };
}

export const issuePassport = mutation({
  args: { agentName: v.string() },
  returns: v.object({
    agentId: v.id("agents"),
    guildId: v.id("guilds"),
    groupPublicKey: v.string(),
    memberSecret: v.string(),
  }),
  handler: async (ctx, args) => {
    const guild = await getOrCreateDefaultGuild(ctx);
    if (!guild) {
      throw new Error("Unable to create guild.");
    }

    const memberSecret = randomSecret(48);
    const agentId = await ctx.db.insert("agents", {
      guildId: guild._id,
      displayName: args.agentName,
      memberSecret,
      status: "active",
      createdAt: Date.now(),
    });

    return {
      agentId,
      guildId: guild._id,
      groupPublicKey: guild.groupPublicKey,
      memberSecret,
    };
  },
});

export const listAgents = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("agents"),
      guildId: v.id("guilds"),
      displayName: v.string(),
      status: v.union(v.literal("active"), v.literal("revoked")),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const guild = await getDefaultGuild(ctx);
    if (!guild) {
      return [];
    }

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_guild", (q) => q.eq("guildId", guild._id))
      .collect();

    return agents
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((agent) => ({
        id: agent._id,
        guildId: agent.guildId,
        displayName: agent.displayName,
        status: agent.status,
        createdAt: agent.createdAt,
      }));
  },
});

export const getGuild = query({
  args: {},
  returns: v.union(
    v.object({
      id: v.id("guilds"),
      name: v.string(),
      groupPublicKey: v.string(),
      activeAgents: v.number(),
      revokedAgents: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const guild = await getDefaultGuild(ctx);
    if (!guild) {
      return null;
    }

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_guild", (q) => q.eq("guildId", guild._id))
      .collect();

    const activeAgents = agents.filter((agent) => agent.status === "active").length;
    const revokedAgents = agents.filter((agent) => agent.status === "revoked").length;

    return {
      id: guild._id,
      name: guild.name,
      groupPublicKey: guild.groupPublicKey,
      activeAgents,
      revokedAgents,
    };
  },
});

export const listGuildReputation = query({
  args: {},
  returns: v.array(
    v.object({
      guildId: v.id("guilds"),
      guildName: v.string(),
      validActions: v.number(),
      totalActions: v.number(),
      revokedAgents: v.number(),
      trustScore: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const [guilds, signatures] = await Promise.all([
      ctx.db.query("guilds").collect(),
      ctx.db.query("signatures").collect(),
    ]);

    const agentIds = Array.from(new Set(signatures.map((signature) => String(signature.agentId))));
    const agentById = new Map<string, Awaited<ReturnType<typeof ctx.db.get>>>();

    await Promise.all(
      agentIds.map(async (agentId) => {
        const agent = await ctx.db.get(agentId as GenericId<"agents">);
        if (agent) {
          agentById.set(agentId, agent);
        }
      }),
    );

    const reputation = await Promise.all(
      guilds.map(async (guild) => {
        const guildAgents = await ctx.db
          .query("agents")
          .withIndex("by_guild", (q) => q.eq("guildId", guild._id))
          .collect();

        const revokedAgents = guildAgents.filter((agent) => agent.status === "revoked").length;

        const guildSignatures = signatures.filter((signature) => {
          const agent = agentById.get(String(signature.agentId));
          return agent?.guildId === guild._id;
        });

        const validActions = guildSignatures.filter((signature) => {
          const agent = agentById.get(String(signature.agentId));
          return agent?.status === "active";
        }).length;

        const totalActions = guildSignatures.length;
        const baseReliability = totalActions === 0 ? 100 : Math.round((validActions / totalActions) * 100);
        const revocationPenalty = Math.min(40, revokedAgents * 8);
        const trustScore = Math.max(0, Math.min(100, baseReliability - revocationPenalty));

        return {
          guildId: guild._id,
          guildName: guild.name,
          validActions,
          totalActions,
          revokedAgents,
          trustScore,
        };
      }),
    );

    return reputation.sort((left, right) => right.trustScore - left.trustScore);
  },
});

export const signAgentPayload = mutation({
  args: {
    agentId: v.id("agents"),
    payload: v.any(),
  },
  returns: v.object({
    signatureId: v.id("signatures"),
    agentId: v.id("agents"),
    signatureObject: signatureObjectValidator,
  }),
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found.");
    }

    if (agent.status === "revoked") {
      throw new Error("Revoked agents cannot sign new payloads.");
    }

    const signatureObject = await signPayload(args.payload, agent.memberSecret, String(agent.guildId));

    const signatureId = await ctx.db.insert("signatures", {
      agentId: agent._id,
      payloadHash: signatureObject.payloadHash,
      signature: signatureObject.signature,
      timestamp: signatureObject.timestamp,
    });

    return {
      signatureId,
      agentId: agent._id,
      signatureObject,
    };
  },
});

export const revokeAgent = mutation({
  args: {
    agentId: v.id("agents"),
  },
  returns: v.union(
    v.object({
      id: v.id("agents"),
      status: v.union(v.literal("active"), v.literal("revoked")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return null;
    }

    await ctx.db.patch(args.agentId, { status: "revoked" });
    return { id: args.agentId, status: "revoked" as const };
  },
});

export const listSignatures = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("signatures"),
      agentId: v.id("agents"),
      agentName: v.string(),
      agentStatus: v.union(v.literal("active"), v.literal("revoked")),
      payloadHash: v.string(),
      signature: v.string(),
      timestamp: v.number(),
      signatureObject: signatureObjectValidator,
    }),
  ),
  handler: async (ctx) => {
    const signatures = await ctx.db
      .query("signatures")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);

    const enriched = await Promise.all(
      signatures.map(async (entry) => {
        const agent = await ctx.db.get(entry.agentId);
        if (!agent) {
          return null;
        }

        return {
          id: entry._id,
          agentId: entry.agentId,
          agentName: agent.displayName,
          agentStatus: agent.status,
          payloadHash: entry.payloadHash,
          signature: entry.signature,
          timestamp: entry.timestamp,
          signatureObject: {
            payloadHash: entry.payloadHash,
            signature: entry.signature,
            timestamp: entry.timestamp,
            groupId: String(agent.guildId),
          },
        };
      }),
    );

    return enriched.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  },
});

export const openSignature = query({
  args: {
    signatureObject: signatureObjectValidator,
  },
  returns: v.union(
    v.object({
      agentId: v.id("agents"),
      displayName: v.string(),
      status: v.union(v.literal("active"), v.literal("revoked")),
      guildName: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const guild = await getDefaultGuild(ctx);
    if (!guild || guild._id !== args.signatureObject.groupId) {
      return null;
    }

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_guild", (q) => q.eq("guildId", guild._id))
      .collect();

    for (const agent of agents) {
      const expected = await deriveSignatureFromHash(args.signatureObject.payloadHash, agent.memberSecret);
      if (expected === args.signatureObject.signature) {
        return {
          agentId: agent._id,
          displayName: agent.displayName,
          status: agent.status,
          guildName: guild.name,
        };
      }
    }

    return null;
  },
});

export const verifyPassportInternal = query({
  args: {
    payload: v.any(),
    signatureObject: signatureObjectValidator,
  },
  returns: v.object({
    status: v.union(v.literal("valid"), v.literal("revoked"), v.literal("invalid")),
    guildName: v.union(v.string(), v.null()),
    unlinkable: v.boolean(),
    traceableByIssuer: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const guild = await getDefaultGuild(ctx);
    if (!guild || guild._id !== args.signatureObject.groupId) {
      return makeVerificationResponse("invalid", null);
    }

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_guild", (q) => q.eq("guildId", guild._id))
      .collect();

    for (const agent of agents) {
      const isMatch = await verifySignature(args.payload, args.signatureObject as SignatureObject, agent.memberSecret);
      if (!isMatch) {
        continue;
      }

      if (agent.status === "revoked") {
        return makeVerificationResponse("revoked", guild.name);
      }

      return makeVerificationResponse("valid", guild.name);
    }

    return makeVerificationResponse("invalid", guild.name);
  },
});

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const verifyPassport = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (request.method !== "POST") {
    return withCors(
      new Response(JSON.stringify({ error: "Method not allowed." }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  try {
    const body = await request.json();

    const result = await ctx.runQuery(anyApi.passports.verifyPassportInternal, {
      payload: body.payload,
      signatureObject: body.signatureObject,
    });

    return withCors(
      new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch {
    return withCors(
      new Response(JSON.stringify({ error: "Invalid verification payload." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
});
