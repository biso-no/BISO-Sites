/**
 * The admin's session cookie, the only place its name is written. In
 * production it is set on `.biso.no`, so docs reads it too.
 *
 * `APPWRITE_SESSION_COOKIE` must equal it, because `createSessionClient()` in
 * `@repo/api/server` reads the cookie by that variable.
 * `src/instrumentation.ts` refuses to start otherwise.
 */
export const ADMIN_SESSION_COOKIE = "biso_session_admin";
