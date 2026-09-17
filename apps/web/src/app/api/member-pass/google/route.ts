import {
  googleWalletTotpKeyHex,
  readMemberPassSecret,
} from "@repo/shared/utils/member-pass";
import { connection, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  buildGoogleWalletObject,
  signGoogleSaveJwt,
} from "@/lib/member-pass/google-pass";
import { resolveMemberPass } from "@/lib/member-pass/resolve";
import { termLabel } from "@/lib/member-pass/term-label";
import { readGoogleWalletConfig } from "@/lib/member-pass/wallet-config";

const NO_STORE = { "Cache-Control": "private, no-store" };
const SAVE_URL = "https://pay.google.com/gp/v/save/";

function error(status: number, code: string) {
  return NextResponse.json({ error: code }, { headers: NO_STORE, status });
}

/** Redirects the signed-in member to a "Save to Google Wallet" link. */
export async function GET() {
  // Render per request, not at build time. Without this, `cacheComponents`
  // sees no dynamic API used before the early `not_configured` 404 (no
  // wallet credentials at build time) and bakes that 404 in statically, so
  // production serves a frozen 404 even once credentials are configured.
  await connection();
  const config = readGoogleWalletConfig();
  const secret = readMemberPassSecret();
  if (!(config && secret)) {
    return error(404, "not_configured");
  }
  const resolved = await resolveMemberPass();
  if (resolved.state === "unauthenticated") {
    return error(401, "not_authenticated");
  }
  if (resolved.state !== "active") {
    return error(403, resolved.state);
  }

  try {
    const t = await getTranslations("memberPass");
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://biso.no";
    const { holder, userId } = resolved;
    const jwt = signGoogleSaveJwt({
      config,
      genericObject: buildGoogleWalletObject({
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
      }),
      now: new Date(),
      origins: [baseUrl],
    });
    return NextResponse.redirect(`${SAVE_URL}${jwt}`, {
      headers: NO_STORE,
      status: 302,
    });
  } catch (cause) {
    console.error("[Member Pass] Google Wallet link failed:", cause);
    return error(500, "failed");
  }
}
