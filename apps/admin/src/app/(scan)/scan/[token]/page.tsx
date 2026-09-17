import { dayColor, readMemberPassSecret } from "@repo/shared/utils/member-pass";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ScannerScreen } from "@/components/member-pass-scanner/scanner-screen";
import { resolveGuestLink, scanWithGuestLink } from "../actions";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { follow: false, index: false },
  title: "BISO scanner",
};

export default async function GuestScannerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("adminPortal.memberPass");
  const secret = readMemberPassSecret();
  const link = secret ? await resolveGuestLink(token).catch(() => null) : null;

  if (!(secret && link)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="font-bold text-2xl">{t("guest.invalidTitle")}</h1>
        <p className="text-muted-foreground">{t("guest.invalidDescription")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-black p-2">
      <ScannerScreen
        dayColor={dayColor(new Date(), secret)}
        onScan={scanWithGuestLink.bind(null, token)}
        subtitle={t("scanDescription")}
        title={link.label}
      />
    </div>
  );
}
