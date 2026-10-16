import {
  buildGoogleWalletObject,
  signGoogleSaveJwt,
} from "@repo/shared/member-pass/google-pass";
import { syncGoogleWalletPass } from "@repo/shared/member-pass/google-wallet-api";
import { termLabel } from "@repo/shared/member-pass/term-label";
import { readGoogleWalletConfig } from "@repo/shared/member-pass/wallet-config";
import {
  googleWalletTotpKeyHex,
  readMemberPassSecret,
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

function json(body: { saveUrl: string }, origin: string | null) {
  const response = NextResponse.json(body);
  response.headers.set("Cache-Control", "private, no-store");
  return applyCorsHeaders(response, origin);
}

async function syncPass(
  ...args: Parameters<typeof syncGoogleWalletPass>
): Promise<boolean> {
  try {
    await syncGoogleWalletPass(...args);
    return true;
  } catch (cause) {
    console.error("[Member Pass] Google Wallet API failed:", cause);
    return false;
  }
}

/**
 * A "Save to Google Wallet" link for the app caller's pass. Unlike the
 * website's redirect, the app follows a JSON `saveUrl` itself.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const config = readGoogleWalletConfig();
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
    const baseUrl = webBaseUrl() ?? "https://biso.no";
    const { holder, userId } = resolved;
    const genericObject = buildGoogleWalletObject({
      holder,
      issuerId: config.issuerId,
      labels: {
        member: t("member"),
        validUntil: t("walletLabels.validUntil"),
      },
      logoUrl: `${baseUrl}/apple-touch-icon.png`,
      termLabel: termLabel(t, holder),
      totpKeyHex: googleWalletTotpKeyHex(userId, secret),
      userId,
    });
    // Write the pass through the Wallet API so the TOTP key stays out of the
    // save link, and so a renewal updates a pass the member already saved.
    if (!(await syncPass(config, genericObject))) {
      return error(502, "wallet_unavailable", origin);
    }
    const jwt = signGoogleSaveJwt({
      config,
      now: new Date(),
      objectId: genericObject.id,
      origins: [baseUrl],
    });
    return json({ saveUrl: `https://pay.google.com/gp/v/save/${jwt}` }, origin);
  } catch (cause) {
    console.error("[Member Pass] Google Wallet link failed:", cause);
    return error(500, "failed", origin);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
