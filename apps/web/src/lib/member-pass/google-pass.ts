import "server-only";
import { createSign } from "node:crypto";
import { googleWalletCodePattern } from "@repo/shared/utils/member-pass";
import { WALLET_COLORS } from "./apple-pass";
import type { MemberPassHolder } from "./types";
import type { GoogleWalletConfig } from "./wallet-config";

const ID_UNSAFE_RE = /[^A-Za-z0-9._-]/g;
const TOTP_PERIOD_MS = "30000";
const TOTP_DIGITS = 6;

export function googleClassId(issuerId: string): string {
  return `${issuerId}.biso-membership`;
}

export function googleObjectId(issuerId: string, userId: string): string {
  return `${issuerId}.member-${userId.replace(ID_UNSAFE_RE, "_")}`;
}

function localized(value: string) {
  return { defaultValue: { language: "en-US", value } };
}

export function buildGoogleWalletObject(input: {
  holder: MemberPassHolder;
  issuerId: string;
  labels: { member: string; validUntil: string };
  logoUrl: string;
  termLabel: string;
  totpKeyHex: string;
  userId: string;
}): { id: string } & Record<string, unknown> {
  const { holder } = input;
  return {
    cardTitle: localized("BISO"),
    classId: googleClassId(input.issuerId),
    header: localized(holder.name),
    hexBackgroundColor: WALLET_COLORS.background,
    id: googleObjectId(input.issuerId, input.userId),
    logo: { sourceUri: { uri: input.logoUrl } },
    rotatingBarcode: {
      totpDetails: {
        algorithm: "TOTP_SHA1",
        parameters: [{ key: input.totpKeyHex, valueLength: TOTP_DIGITS }],
        periodMillis: TOTP_PERIOD_MS,
      },
      type: "QR_CODE",
      valuePattern: googleWalletCodePattern(input.userId),
    },
    state: "ACTIVE",
    subheader: localized(input.labels.member),
    textModulesData: [
      { body: input.termLabel, header: input.labels.member, id: "term" },
      {
        body: holder.expiryDate,
        header: input.labels.validUntil,
        id: "expiry",
      },
    ],
    // Display window only (whole days, UTC); the scanner's live Finago check
    // is what decides whether the pass is honoured.
    validTimeInterval: {
      end: { date: `${holder.expiryDate}T23:59:59Z` },
      start: { date: `${holder.startDate}T00:00:00Z` },
    },
  };
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** An RS256 JWT signed with the service account's private key. */
export function signServiceAccountJwt(
  claims: Record<string, unknown>,
  privateKey: string
): string {
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson(claims);
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(privateKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

/**
 * A "Save to Google Wallet" JWT that only references this member's Generic
 * Object. The object (and its TOTP key) must already have been written
 * through the Wallet API, so the save link carries no secrets.
 */
export function signGoogleSaveJwt(input: {
  config: GoogleWalletConfig;
  now: Date;
  objectId: string;
  origins: string[];
}): string {
  return signServiceAccountJwt(
    {
      aud: "google",
      iat: Math.floor(input.now.getTime() / 1000),
      iss: input.config.clientEmail,
      origins: input.origins,
      payload: {
        genericObjects: [
          {
            classId: googleClassId(input.config.issuerId),
            id: input.objectId,
          },
        ],
      },
      typ: "savetowallet",
    },
    input.config.privateKey
  );
}
