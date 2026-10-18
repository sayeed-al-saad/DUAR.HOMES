import { createHash } from "node:crypto";

/**
 * Deterministic UUID (version 5 layout) for seed data.
 *
 * The bundled demo data and the generated SQL both call this, so a location or
 * demo listing has the same id in demo mode and in the database.
 * Server-side and scripts only.
 */
const NAMESPACE = "duar-seed-v1";

export function stableUuid(kind: string, key: string): string {
  const hash = createHash("sha1").update(`${NAMESPACE}:${kind}:${key}`).digest();
  const bytes = Uint8Array.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
