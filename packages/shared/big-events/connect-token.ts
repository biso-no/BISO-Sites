/**
 * Personal "connect your ticket" links. A participant keeps one random nonce;
 * the token in the link is an HMAC of the participant id and that nonce under
 * `BIG_EVENTS_CONNECT_SECRET`, so a reminder carries the same link as the
 * first email without the token ever being stored. Only its SHA-256 hash is
 * kept (`connect_token_hash`), to look the participant up when the link is
 * opened.
 */

import { createHash, createHmac, randomBytes } from "node:crypto";

const NONCE_BYTES = 16;

/** The token for a participant's link: base64url HMAC-SHA256 of `${participantId}:${nonce}`. */
export function deriveConnectToken(
  secret: string,
  participantId: string,
  nonce: string
): string {
  if (!secret) {
    throw new Error("A connect secret is required to make connect links.");
  }
  return createHmac("sha256", secret)
    .update(`${participantId}:${nonce}`)
    .digest("base64url");
}

/** What is stored and looked up: the hex SHA-256 of a token. */
export function hashConnectToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A fresh nonce: 16 random bytes as hex. */
export function newConnectNonce(): string {
  return randomBytes(NONCE_BYTES).toString("hex");
}
