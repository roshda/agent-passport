export type AgentStatus = "active" | "revoked";

export interface SignatureObject {
  payloadHash: string;
  signature: string;
  timestamp: number;
  groupId: string;
}

export interface AgentRecord {
  id: string;
  guildId: string;
  displayName: string;
  status: AgentStatus;
  createdAt: number;
}

export interface GuildSummary {
  id: string;
  name: string;
  groupPublicKey: string;
  activeAgents: number;
  revokedAgents: number;
}

export interface VerificationResult {
  status: "valid" | "revoked" | "invalid";
  guildName: string | null;
  unlinkable: boolean;
  traceableByIssuer: boolean;
}

export interface SignatureRecord {
  id: string;
  agentId: string;
  agentName: string;
  agentStatus: AgentStatus;
  payloadHash: string;
  signature: string;
  timestamp: number;
  signatureObject: SignatureObject;
}

export interface GuildReputation {
  guildId: string;
  guildName: string;
  validActions: number;
  totalActions: number;
  revokedAgents: number;
  trustScore: number;
}

export type GatewayDecision = "allow" | "block" | "rate_limit";

export interface GatewayRequestRecord {
  id: string;
  requestId: string;
  payload: Record<string, unknown>;
  payloadLabel: string;
  verificationStatus: "valid" | "revoked" | "invalid";
  guildName: string | null;
  decision: GatewayDecision;
  reason: string;
  source: string;
  timestamp: number;
}
