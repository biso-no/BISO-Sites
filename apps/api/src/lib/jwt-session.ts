function stringClaim(jwt: string, name: "sessionId" | "userId"): string | null {
  const payload = jwt.split(".")[1];
  if (!payload) {
    return null;
  }
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
    const value = (claims as Record<string, unknown> | null)?.[name];
    return typeof value === "string" && value ? value : null;
  } catch {
    return null;
  }
}

/**
 * The `sessionId` claim of an Appwrite JWT, or null when there is none.
 *
 * This only decodes the payload; it does not verify the signature. Call it
 * after `account.get()` has accepted the same JWT (Appwrite has then verified
 * it), and only trust the result when `userIdFromJwt` matches the account
 * `account.get()` returned.
 */
export function sessionIdFromJwt(jwt: string): string | null {
  return stringClaim(jwt, "sessionId");
}

/** The `userId` claim of an Appwrite JWT, or null. Same caveats as above. */
export function userIdFromJwt(jwt: string): string | null {
  return stringClaim(jwt, "userId");
}
