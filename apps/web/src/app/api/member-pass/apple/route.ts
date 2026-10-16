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
import { connection, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { resolveMemberPass } from "@/lib/member-pass/resolve";

const NO_STORE = { "Cache-Control": "private, no-store" };

function error(status: number, code: string) {
  return NextResponse.json({ error: code }, { headers: NO_STORE, status });
}

/** The signed-in member's pass as a downloadable `.pkpass` for Apple Wallet. */
export async function GET() {
  // Render per request, not at build time. Without this, `cacheComponents`
  // sees no dynamic API used before the early `not_configured` 404 (no
  // wallet credentials at build time) and bakes that 404 in statically, so
  // production serves a frozen 404 even once credentials are configured.
  await connection();
  const config = readAppleWalletConfig();
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
      icon: await loadWalletIcon(
        process.env.NEXT_PUBLIC_BASE_URL ?? "https://biso.no"
      ),
      userId,
    });
    return new NextResponse(new Uint8Array(pass), {
      headers: {
        ...NO_STORE,
        "Content-Disposition": 'attachment; filename="biso-membership.pkpass"',
        "Content-Type": "application/vnd.apple.pkpass",
      },
    });
  } catch (cause) {
    console.error("[Member Pass] Apple Wallet pass failed:", cause);
    return error(500, "failed");
  }
}
