import { createHash, createHmac, randomBytes } from "node:crypto";

const TOKEN_LENGTH_BYTES = 32;

function readSecret(): string {
  const secret = process.env.RECRUITMENT_BOOKING_SECRET;
  if (!secret) {
    throw new Error(
      "RECRUITMENT_BOOKING_SECRET is not set. Configure it before issuing booking tokens."
    );
  }
  return secret;
}

export interface IssuedBookingToken {
  /** Hex digest used as the stored lookup key. */
  hash: string;
  /** Opaque URL-safe token that's emailed to the candidate. Never persisted. */
  token: string;
}

export function issueBookingToken(): IssuedBookingToken {
  const random = randomBytes(TOKEN_LENGTH_BYTES).toString("base64url");
  const secret = readSecret();
  const signature = createHmac("sha256", secret)
    .update(random)
    .digest("base64url");
  const token = `${random}.${signature}`;
  const hash = createHash("sha256").update(token).digest("hex");
  return { hash, token };
}

export function hashBookingToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyBookingTokenSignature(token: string): boolean {
  const [random, signature] = token.split(".");
  if (!(random && signature)) {
    return false;
  }
  try {
    const secret = readSecret();
    const expected = createHmac("sha256", secret)
      .update(random)
      .digest("base64url");
    return safeStringEquals(expected, signature);
  } catch {
    return false;
  }
}

function safeStringEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    // biome-ignore lint/suspicious/noBitwiseOperators: constant-time comparison to prevent timing attacks
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
