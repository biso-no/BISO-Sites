import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PublicPageHeader } from "@/components/public/PublicPageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("press.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function PressPage() {
  const t = await getTranslations("press");
  const assets = [
    {
      key: "logoLight",
      label: t("assets.logoLight"),
      href: "/images/logo-light.png",
    },
    {
      key: "logoDark",
      label: t("assets.logoDark"),
      href: "/images/logo-dark.png",
    },
    {
      key: "orgChart",
      label: t("assets.orgChart"),
      href: "/images/org-chart.png",
    },
  ];
  return (
    <div className="space-y-6">
      <PublicPageHeader
        title={t("title")}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: t("title") }]}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("contact.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>{t("contact.body")}</div>
          <div>
            <Link className="underline" href="mailto:post@biso.no">
              post@biso.no
            </Link>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("assets.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc ml-5">
            {assets.map((a) => (
              <li key={a.key}>
                <a className="underline" href={a.href} download>
                  {a.label}
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("usage.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none text-sm">{t("usage.body")}</div>
        </CardContent>
      </Card>
    </div>
  );
}
