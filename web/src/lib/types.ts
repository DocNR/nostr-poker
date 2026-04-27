/**
 * Primitive types shared across the (currently scaffold-only) lib modules.
 *
 * Online-poker domain types (Hand, Action, Showdown, etc.) will live in
 * a fresh `poker.ts` once implementation begins.
 */

export type Pubkey = string;     // 64-char hex
export type EventId = string;    // 64-char hex
export type Sats = number;       // non-negative integer for amounts

/**
 * An unsigned Nostr event template (no id, sig, pubkey, created_at).
 * The signer fills in the missing fields.
 */
export interface EventTemplate {
  kind: number;
  tags: string[][];
  content: string;
}
