import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { NextResponse } from "next/server";
import { canManageAccounting } from "@/lib/roles";
import { getUserAuthContext, type UserAuthContext } from "./authorization";

export interface ApiAuthSuccess {
  ctx: UserAuthContext;
  response?: never;
}
export interface ApiAuthFailure {
  ctx?: never;
  response: NextResponse;
}
export type ApiAuthResult = ApiAuthSuccess | ApiAuthFailure;

export async function requireApiAuth(): Promise<ApiAuthResult> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ctx };
}

export async function requireApiGlobalAdmin(): Promise<ApiAuthResult> {
  const auth = await requireApiAuth();
  if (auth.response) {
    return auth;
  }
  if (!auth.ctx.roles.includes("globaladmin")) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return auth;
}

export async function requireApiAccountingAdmin(): Promise<ApiAuthResult> {
  const auth = await requireApiAuth();
  if (auth.response) {
    return auth;
  }
  if (!canManageAccounting(auth.ctx.roles)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return auth;
}

function readBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * The gate for the routes the scheduled-dispatch Appwrite Function calls:
 * CRON_SECRET, from an `Authorization: Bearer` or an `x-cron-secret` header,
 * compared in constant time. Header-only, so the secret stays out of access
 * logs and referrers. No user session is needed. Answers 500 when CRON_SECRET
 * isn't set and 401 when the secret doesn't match; null lets the caller go on.
 */
export function requireCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { code: "SECRET_NOT_CONFIGURED", error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }
  const candidates = [
    readBearerToken(request),
    request.headers.get("x-cron-secret"),
  ];
  if (!candidates.some((candidate) => safeSecretCompare(candidate, secret))) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", error: "Unauthorized" },
      { status: 401 }
    );
  }
  return null;
}
