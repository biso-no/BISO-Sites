import { createHmac, timingSafeEqual } from "node:crypto";
import {
  MEMBER_PASS_BATCH_SIZE,
  MEMBER_PASS_SLOT_TOLERANCE,
  type MemberPassCode,
  passSlot,
} from "./member-pass-slots";
import { osloToday } from "./membership-dates";

/**
 * Member pass codes. Server-only: every function here needs the secret.
 *
 *   v1.<userId>.<slot>.<sig>      web pass, one code per 30 s slot
 *   g1.<userId>.<totp>            Google Wallet rotating barcode
 *   a1.<userId>.<YYYYMMDD>.<sig>  Apple Wallet (static; Wallet cannot rotate)
 *
 * Codes carry only the Appwrite user id. They are not URLs, so a phone
 * camera shows opaque text.
 */

export const MEMBER_PASS_SECRET_ENV = "MEMBER_PASS_SECRET";
const MIN_SECRET_LENGTH = 32;
const SIGNATURE_BYTES = 16;
const GOOGLE_TOTP_KEY_BYTES = 20;
const GOOGLE_TOTP_DIGITS = 6;
export const DUPLICATE_SCAN_WINDOW_MS = 10 * 60 * 1000;

const USER_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;
// No leading zeros: "007" and "7" must not both verify against the
// signature computed for the canonical slot number 7.
const SLOT_RE = /^(0|[1-9]\d{0,11})$/;
const COMPACT_DATE_RE = /^(\d{4})(\d{2})(\d{2})$/;
const TOTP_RE = /^\d{6}$/;
const DASH_RE = /-/g;

export type MemberPassCodeKind = "web" | "google" | "apple";

export type MemberPassVerifyResult =
  | { kind: "web" | "google"; ok: true; slot: number; userId: string }
  | { expiry: string; kind: "apple"; ok: true; userId: string }
  | {
      ok: false;
      reason: "malformed" | "bad_signature" | "stale" | "expired";
    };

export function readMemberPassSecret(
  env: Record<string, string | undefined> = process.env
): string | null {
  const value = env[MEMBER_PASS_SECRET_ENV]?.trim();
  return value && value.length >= MIN_SECRET_LENGTH ? value : null;
}

function signature(secret: string, payload: string): string {
  return createHmac("sha256", secret)
    .update(payload)
    .digest()
    .subarray(0, SIGNATURE_BYTES)
    .toString("base64url");
}

function signaturesMatch(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signWebPassCode(
  userId: string,
  slot: number,
  secret: string
): string {
  const payload = `v1.${userId}.${slot}`;
  return `${payload}.${signature(secret, payload)}`;
}

export function issueWebPassCodes(
  userId: string,
  nowMs: number,
  secret: string
): MemberPassCode[] {
  const first = passSlot(nowMs);
  return Array.from({ length: MEMBER_PASS_BATCH_SIZE }, (_, index) => {
    const slot = first + index;
    return { code: signWebPassCode(userId, slot, secret), slot };
  });
}

export function signAppleWalletCode(
  userId: string,
  expiryDate: string,
  secret: string
): string {
  const payload = `a1.${userId}.${expiryDate.replace(DASH_RE, "")}`;
  return `${payload}.${signature(secret, payload)}`;
}

export function googleWalletTotpKeyHex(userId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`g1-totp.${userId}`)
    .digest()
    .subarray(0, GOOGLE_TOTP_KEY_BYTES)
    .toString("hex");
}

export function googleWalletCodePattern(userId: string): string {
  return `g1.${userId}.{totp_value_0}`;
}

// RFC 6238 dynamic truncation, written without bitwise operators (banned by
// lint/suspicious/noBitwiseOperators): masking a non-negative byte to its low
// nibble or clearing its top bit is the same as taking it modulo 16 or 128,
// and OR-ing byte-shifted values that occupy disjoint bit ranges is the same
// as adding them.
const DYNAMIC_TRUNCATION_MODULUS = 16; // low nibble of the last hash byte
const SIGN_BIT_MODULUS = 128; // clears the top bit of a single byte

/** RFC 6238 TOTP (HMAC-SHA1) for an explicit time-step counter. */
export function totp(key: Buffer, counter: number, digits = 6): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac("sha1", key).update(message).digest();
  const offset = (hash.at(-1) ?? 0) % DYNAMIC_TRUNCATION_MODULUS;
  const binary =
    ((hash[offset] ?? 0) % SIGN_BIT_MODULUS) * 2 ** 24 +
    (hash[offset + 1] ?? 0) * 2 ** 16 +
    (hash[offset + 2] ?? 0) * 2 ** 8 +
    (hash[offset + 3] ?? 0);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

const MALFORMED = { ok: false, reason: "malformed" } as const;
const BAD_SIGNATURE = { ok: false, reason: "bad_signature" } as const;
const STALE = { ok: false, reason: "stale" } as const;

function withinTolerance(slot: number, current: number): boolean {
  return Math.abs(slot - current) <= MEMBER_PASS_SLOT_TOLERANCE;
}

function verifyWeb(
  parts: string[],
  secret: string,
  current: number
): MemberPassVerifyResult {
  const sig = parts.at(-1) ?? "";
  const slotText = parts.at(-2) ?? "";
  const userId = parts.slice(1, -2).join(".");
  if (!(SLOT_RE.test(slotText) && USER_ID_RE.test(userId))) {
    return MALFORMED;
  }
  const slot = Number(slotText);
  if (!signaturesMatch(signature(secret, `v1.${userId}.${slot}`), sig)) {
    return BAD_SIGNATURE;
  }
  if (!withinTolerance(slot, current)) {
    return STALE;
  }
  return { kind: "web", ok: true, slot, userId };
}

function verifyGoogle(
  parts: string[],
  secret: string,
  current: number
): MemberPassVerifyResult {
  const value = parts.at(-1) ?? "";
  const userId = parts.slice(1, -1).join(".");
  if (!(TOTP_RE.test(value) && USER_ID_RE.test(userId))) {
    return MALFORMED;
  }
  const key = Buffer.from(googleWalletTotpKeyHex(userId, secret), "hex");
  for (
    let slot = current - MEMBER_PASS_SLOT_TOLERANCE;
    slot <= current + MEMBER_PASS_SLOT_TOLERANCE;
    slot += 1
  ) {
    if (signaturesMatch(totp(key, slot, GOOGLE_TOTP_DIGITS), value)) {
      return { kind: "google", ok: true, slot, userId };
    }
  }
  // A TOTP value cannot distinguish "wrong key" from "old step"; both are
  // reported as stale so a scanner tells the holder to refresh.
  return STALE;
}

function verifyApple(
  parts: string[],
  secret: string,
  now: Date
): MemberPassVerifyResult {
  const sig = parts.at(-1) ?? "";
  const compact = parts.at(-2) ?? "";
  const userId = parts.slice(1, -2).join(".");
  const date = COMPACT_DATE_RE.exec(compact);
  if (!(date && USER_ID_RE.test(userId))) {
    return MALFORMED;
  }
  if (!signaturesMatch(signature(secret, `a1.${userId}.${compact}`), sig)) {
    return BAD_SIGNATURE;
  }
  const expiry = `${date[1]}-${date[2]}-${date[3]}`;
  if (expiry < osloToday(now)) {
    return { ok: false, reason: "expired" };
  }
  return { expiry, kind: "apple", ok: true, userId };
}

const MIN_PARTS = { a1: 4, g1: 3, v1: 4 } as const;

export function verifyMemberPassCode(
  code: string,
  secret: string,
  now: Date
): MemberPassVerifyResult {
  const parts = code.trim().split(".");
  const prefix = parts[0] ?? "";
  // Compare against the three known literal prefixes rather than indexing
  // MIN_PARTS with an attacker-controlled key: a plain object lookup lets an
  // inherited key ("constructor", "__proto__", "toString",
  // "hasOwnProperty", ...) pass an `undefined` check and fall through to the
  // final `return verifyApple(...)` below.
  if (prefix !== "a1" && prefix !== "g1" && prefix !== "v1") {
    return MALFORMED;
  }
  if (parts.length < MIN_PARTS[prefix]) {
    return MALFORMED;
  }
  const current = passSlot(now.getTime());
  if (prefix === "v1") {
    return verifyWeb(parts, secret, current);
  }
  if (prefix === "g1") {
    return verifyGoogle(parts, secret, current);
  }
  return verifyApple(parts, secret, now);
}

export const DAY_COLORS = [
  { hex: "#E5484D", name: "red" },
  { hex: "#F76B15", name: "orange" },
  { hex: "#FFC53D", name: "yellow" },
  { hex: "#7CB518", name: "lime" },
  { hex: "#30A46C", name: "green" },
  { hex: "#12A594", name: "teal" },
  { hex: "#00A2C7", name: "cyan" },
  { hex: "#0090FF", name: "blue" },
  { hex: "#3E63DD", name: "indigo" },
  { hex: "#8E4EC6", name: "purple" },
  { hex: "#D6409F", name: "pink" },
  { hex: "#AD7F58", name: "brown" },
] as const;

export type DayColorName = (typeof DAY_COLORS)[number]["name"];

export interface DayColor {
  hex: string;
  name: DayColorName;
}

/**
 * Today's pass color. Shown on every pass and every scanner so a guard can
 * spot a copy made on another day. Unpredictable without the secret.
 */
export function dayColor(now: Date, secret: string): DayColor {
  const digest = createHmac("sha256", secret)
    .update(`day.${osloToday(now)}`)
    .digest();
  const color = DAY_COLORS[digest.readUInt32BE(0) % DAY_COLORS.length];
  return { hex: color?.hex ?? DAY_COLORS[0].hex, name: color?.name ?? "red" };
}

export function isRecentDuplicate(
  previousScanAt: Date | null,
  now: Date
): boolean {
  if (!previousScanAt) {
    return false;
  }
  return now.getTime() - previousScanAt.getTime() < DUPLICATE_SCAN_WINDOW_MS;
}
