import { NextResponse } from "next/server";
import { getUserAuthContext, type UserAuthContext } from "./authorization";

export type ApiAuthSuccess = { ctx: UserAuthContext; response?: never };
export type ApiAuthFailure = { ctx?: never; response: NextResponse };
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
