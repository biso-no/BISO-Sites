import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCampuses } from "@/app/actions/campus";
import { PublicPageHeader } from "@/components/public/public-page-header";

export const metadata: Metadata = {
  title: "Contact | BISO",
  description: "Contact BISO nationally or at your campus.",
};

export default async function ContactPage() {
  const [t, campuses] = await Promise.all([
    getTranslations("contact"),
    getCampuses(),
  ]);
  return (
    <div className="space-y-6">
      <PublicPageHeader
        breadcrumbs={[{ label: "Home", href: "/" }, { label: t("title") }]}
        title={t("title")}
      />
      <p className="text-muted-foreground text-sm">{t("intro")}</p>
      <div className="rounded-lg border bg-white p-4">
        <div className="font-semibold">{t("national.title")}</div>
        <div className="text-muted-foreground text-sm">
          {t("national.body")}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campuses.map((c) => (
          <div className="rounded-lg border bg-white p-4" key={c.$id}>
            <div className="font-semibold">{c.name}</div>
            {c.email && (
              <div className="text-muted-foreground text-sm">
                <a className="underline" href={`mailto:${c.email}`}>
                  {c.email}
                </a>
              </div>
            )}
          </div>
        ))}
        {campuses.length === 0 && (
          <div className="text-muted-foreground text-sm">
            {t("campuses.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
