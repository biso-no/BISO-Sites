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
