import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/app/actions/locale";
import { PublicPageHeader } from "@/components/public/PublicPageHeader";

export const metadata: Metadata = {
  title: "Privacy Policy | BISO",
  description: "How BI Student Organisation (BISO) processes personal data.",
};

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const _locale = (await getLocale()) as "no" | "en";
  return (
    <div className="space-y-6">
      <PublicPageHeader
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Privacy" }]}
        title={t("title")}
      />
      <div className="prose max-w-none space-y-4">
        <p>{t("intro")}</p>
        <h3>{t("sections.data.title")}</h3>
        <ul>
          <li>{t("sections.data.items.0")}</li>
          <li>{t("sections.data.items.1")}</li>
          <li>{t("sections.data.items.2")}</li>
        </ul>
        <h3>{t("sections.legal.title")}</h3>
        <p>{t("sections.legal.body")}</p>
        <h3>{t("sections.retention.title")}</h3>
        <p>{t("sections.retention.body")}</p>
        <h3>{t("sections.rights.title")}</h3>
        <ul>
          <li>{t("sections.rights.items.0")}</li>
          <li>{t("sections.rights.items.1")}</li>
          <li>{t("sections.rights.items.2")}</li>
          <li>{t("sections.rights.items.3")}</li>
        </ul>
        <h3>{t("sections.contact.title")}</h3>
        <p>{t("sections.contact.body")}</p>
      </div>
    </div>
  );
}
