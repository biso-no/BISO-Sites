import {
  applePassFields,
  buildAppleWalletPass,
  loadWalletIcon,
} from "@repo/shared/member-pass/apple-pass";
import { termLabel } from "@repo/shared/member-pass/term-label";
import { readAppleWalletConfig } from "@repo/shared/member-pass/wallet-config";
import {
  readMemberPassSecret,
  signAppleWalletCode,
} from "@repo/shared/utils/member-pass";
import { type NextRequest, NextResponse } from "next/server";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { memberPassTranslator } from "@/lib/member-pass/labels";
import { resolveMemberPassForRequest } from "@/lib/member-pass/resolve";
import { webBaseUrl } from "@/lib/public-urls";

export const dynamic = "force-dynamic";

function error(status: number, code: string, origin: string | null) {
  const response = NextResponse.json({ error: code }, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return applyCorsHeaders(response, origin);
}

/** The app caller's pass as a downloadable `.pkpass` for Apple Wallet. */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const config = readAppleWalletConfig();
  const secret = readMemberPassSecret();
  if (!(config && secret)) {
    return error(404, "not_configured", origin);
  }
  const resolved = await resolveMemberPassForRequest(req);
  if (resolved.state === "unauthenticated") {
    return error(401, "not_authenticated", origin);
  }
  if (resolved.state !== "active") {
    return error(403, resolved.state, origin);
  }

  try {
    const t = memberPassTranslator(req.headers.get("accept-language"));
    const { holder, userId } = resolved;
    const pass = await buildAppleWalletPass({
      code: signAppleWalletCode(userId, holder.expiryDate, secret),
      config,
      expiryDate: holder.expiryDate,
      fields: applePassFields(
        holder,
        {
          member: t("member"),
          membership: t("walletLabels.membership"),
          validUntil: t("walletLabels.validUntil"),
        },
        termLabel(t, holder)
      ),
      icon: await loadWalletIcon(webBaseUrl() ?? "https://biso.no"),
      userId,
    });
    const response = new NextResponse(new Uint8Array(pass), {
      headers: {
        "Content-Disposition": 'attachment; filename="biso-membership.pkpass"',
        "Content-Type": "application/vnd.apple.pkpass",
      },
    });
    response.headers.set("Cache-Control", "private, no-store");
    return applyCorsHeaders(response, origin);
  } catch (cause) {
    console.error("[Member Pass] Apple Wallet pass failed:", cause);
    return error(500, "failed", origin);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
