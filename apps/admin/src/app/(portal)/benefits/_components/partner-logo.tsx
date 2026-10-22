import Image from "next/image";
import { logoColor, logoInitials } from "../_lib/board-display";

const LOGO_SIZE = 36;

/**
 * A partner's logo, or its initials on a stable colour when there is none.
 * Decorative: the name is always written next to it. Unoptimized because
 * partner logos may live on any https host, outside `images.remotePatterns`.
 */
export function PartnerLogo({
  logoUrl,
  name,
}: {
  logoUrl: string | null;
  name: string;
}) {
  if (logoUrl) {
    return (
      <Image
        alt=""
        className="h-9 w-9 shrink-0 rounded-lg border border-[#e5dcca] bg-white object-contain"
        height={LOGO_SIZE}
        src={logoUrl}
        unoptimized
        width={LOGO_SIZE}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-bold text-[12px] text-white tracking-[0.04em]"
      style={{ background: logoColor(name) }}
    >
      {logoInitials(name)}
    </span>
  );
}
