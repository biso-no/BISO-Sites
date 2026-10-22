import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { loadMembershipTexts } from "../../_actions/membership-texts";
import { StudioPageHeader } from "../../_components/studio";
import { BOARD_FOCUS_RING } from "../_lib/board-styles";
import { MembershipTextsEditor } from "./_components/membership-texts-editor";

const DEFAULT_WEB_BASE_URL = "https://app.biso.no";
const TRAILING_SLASHES = /\/+$/;

/** Fordeler → Tekster: the membership bullet lists around the website. */
export default async function BenefitTextsPage() {
  await requireNavAccess("portal.benefitsTexts");
  const [spots, t, uiLocale] = await Promise.all([
    loadMembershipTexts(),
    getTranslations("adminPortal.benefits.texts"),
    getLocale(),
  ]);
  const webBaseUrl = (
    process.env.NEXT_PUBLIC_WEB_BASE_URL || DEFAULT_WEB_BASE_URL
  ).replace(TRAILING_SLASHES, "");

  return (
    <div className="pb-16">
      <StudioPageHeader
        description={t("description")}
        eyebrow={
          <Link
            className={`-mx-1 inline-flex items-center gap-1.5 rounded-sm px-1 hover:underline ${BOARD_FOCUS_RING}`}
            href="/benefits"
          >
            <ArrowLeft aria-hidden size={12} />
            {t("eyebrow")}
          </Link>
        }
        title={t("title")}
      />
      <MembershipTextsEditor
        locale={uiLocale === "en" ? "en" : "no"}
        spots={spots}
        webBaseUrl={webBaseUrl}
      />
    </div>
  );
}
