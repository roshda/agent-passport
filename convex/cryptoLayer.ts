export interface SignatureObject {
  payloadHash: string;
  signature: string;
  timestamp: number;
  groupId: string;
}

export interface CryptoLayer {
  signPayload(payload: unknown, memberSecret: string, groupId: string): Promise<SignatureObject>;
  verifySignature(payload: unknown, signatureObject: SignatureObject, memberSecret: string): Promise<boolean>;
}

const textEncoder = new TextEncoder();

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalize(entry));
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function stableStringify(payload: unknown): string {
  return JSON.stringify(normalize(payload));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return toHex(new Uint8Array(digest));
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return toHex(new Uint8Array(digest));
}

function constantTimeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function hashPayload(payload: unknown): Promise<string> {
  return sha256Hex(stableStringify(payload));
}

export async function deriveSignatureFromHash(payloadHash: string, memberSecret: string): Promise<string> {
  return hmacSha256Hex(memberSecret, payloadHash);
}

export async function signPayload(
  payload: unknown,
  memberSecret: string,
  groupId: string,
): Promise<SignatureObject> {
  const payloadHash = await hashPayload(payload);
  const signature = await deriveSignatureFromHash(payloadHash, memberSecret);

  return {
    payloadHash,
    signature,
    timestamp: Date.now(),
    groupId,
  };
}

export async function verifySignature(
  payload: unknown,
  signatureObject: SignatureObject,
  memberSecret: string,
): Promise<boolean> {
  const recomputedPayloadHash = await hashPayload(payload);
  if (!constantTimeEquals(recomputedPayloadHash, signatureObject.payloadHash)) {
    return false;
  }

  const expectedSignature = await deriveSignatureFromHash(signatureObject.payloadHash, memberSecret);
  return constantTimeEquals(expectedSignature, signatureObject.signature);
}

export const mockGroupCryptoLayer: CryptoLayer = {
  signPayload,
  verifySignature,
};
