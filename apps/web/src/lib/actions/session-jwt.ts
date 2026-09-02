import { createAdminClient, type createSessionClient } from "@repo/api/server";

type SessionAccount = Awaited<
  ReturnType<typeof createSessionClient>
>["account"];

/**
 * Mint a JWT for the caller's own session.
 *
 * **This exists because `node-appwrite@28` moved `createJWT` off `Account`.**
 * Before, `account.createJWT()` was session-scoped: the session proved whose
 * token it was, and the token was bound to that session. The replacement,
 * `users.createJWT({ userId })`, is an **admin-key** call that will mint a
 * token for *any* user id it is handed. That is a change of minting authority,
 * not a rename, and it is why this lives in one place instead of being inlined
 * at three call sites — two of which are payment paths.
 *
 * The two rules that keep it equivalent to what it replaced:
 *
 * 1. **The user id comes from the session, never from an argument.** The only
 *    parameter is an already-constructed session client; `account.get()` is
 *    what establishes identity. There is deliberately no `userId` parameter to
 *    pass the wrong thing to.
 * 2. **The token is bound to the caller's current session.** `createJWT`
 *    accepts an optional `sessionId`, and without it Appwrite picks one of the
 *    user's sessions on its own — so a token could outlive the logout of the
 *    session that asked for it. Passing the current session's id back keeps
 *    the old lifetime exactly: the JWT dies with the session that minted it.
 */
export async function mintSessionJwt(
  account: SessionAccount
): Promise<string | null> {
  try {
    const [user, session] = await Promise.all([
      account.get(),
      account.getSession({ sessionId: "current" }),
    ]);
    if (!(user?.$id && session?.$id)) {
      return null;
    }

    const { users } = await createAdminClient();
    const jwt = await users.createJWT({
      userId: user.$id,
      sessionId: session.$id,
    });
    return jwt.jwt ?? null;
  } catch (error) {
    console.error("Failed to mint a session JWT:", error);
    return null;
  }
}
