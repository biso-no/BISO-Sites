import { safeSecretCompare } from "@repo/shared/utils/secrets";

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

/** Accepts `Authorization: Bearer <secret>` or `x-cron-secret: <secret>`. */
export function hasValidCronSecret(request: Request, secret: string): boolean {
  return [readBearerToken(request), request.headers.get("x-cron-secret")].some(
    (candidate) => safeSecretCompare(candidate, secret)
  );
}
