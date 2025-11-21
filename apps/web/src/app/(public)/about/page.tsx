"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  BookOpen,
  Building2,
  Gavel,
  GraduationCap,
  HeartHandshake,
  History,
  Landmark,
  ShieldAlert,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { getOrgChartUrl, getPartners, type Partner } from "@/app/actions/about";
import { PublicPageHeader } from "@/components/public/PublicPageHeader";

const tiles: Array<{
  key: keyof typeof import("../../../../messages/en/about.json")["links"]; // type hint only
  href: string;
  icon: React.ComponentType<any>;
}> = [
  { key: "whatIsBiso", href: "/about/what-is-biso", icon: BookOpen },
  { key: "politics", href: "/about/politics", icon: Landmark },
  { key: "bylaws", href: "/about/bylaws", icon: Gavel },
  { key: "history", href: "/about/history", icon: History },
  { key: "studyQuality", href: "/about/study-quality", icon: GraduationCap },
  { key: "operations", href: "/about/operations", icon: Building2 },
  { key: "alumni", href: "/about/alumni", icon: Users },
  { key: "saih", href: "/about/saih", icon: HeartHandshake },
  { key: "varsling", href: "/safety", icon: ShieldAlert },
];

export default function AboutPage() {
  const t = useTranslations("about");
  const [partners, setPartners] = useState<Array<Partner>>([]);
  const [orgChartUrl, setOrgChartUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getPartners();
        const orgChartUrl = await getOrgChartUrl();
        setPartners(res);
        setOrgChartUrl(orgChartUrl);
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-8">
      <PublicPageHeader
        title={t("hub.title")}
        subtitle={t("hub.subtitle")}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: t("hub.title") }]}
      />

      {/* General intro */}
      <div className="prose prose-primary max-w-none space-y-6">
        <p className="text-primary-70">{t("hub.description")}</p>
        <div>
          <h3 className="text-xl font-semibold text-primary-90">
            {t("general.strategy.title", { default: "Strategi" })}
          </h3>
          <p className="text-primary-70">
            {t("general.strategy.subtitle", {
              default: "Vi jobber aktivt mot våre strategiske mål",
            })}
          </p>
          <div className="grid gap-4 sm:grid-cols-3 mt-3">
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("general.strategy.items.impact.title", { default: "Påvirkning" })}
                </CardTitle>
                <CardDescription>
                  {t("general.strategy.items.impact.desc", {
                    default: "Gi studenter en stemme på BI, i studentpolitikken og i samfunnet.",
                  })}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("general.strategy.items.connected.title", { default: "Påkoblet" })}
                </CardTitle>
                <CardDescription>
                  {t("general.strategy.items.connected.desc", {
                    default: "Forene studenter på tvers av campus og knytte dem til næringslivet.",
                  })}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("general.strategy.items.engaged.title", { default: "Engasjert" })}
                </CardTitle>
                <CardDescription>
                  {t("general.strategy.items.engaged.desc", {
                    default:
                      "Et inkluderende, sosialt og givende miljø som beriker BI-opplevelsen.",
                  })}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-primary-90">
            {t("general.whatWeDo.title", { default: "Hva gjør vi" })}
          </h3>
          <p className="text-primary-70">
            {t("general.whatWeDo.lead", {
              default: "Alle midler i BISO skal gå tilbake til studentvelferd...",
            })}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 mt-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="text-primary-70">
                {t(`general.whatWeDo.items.${i}`, { default: "" })}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-primary-90">
            {t("general.academics.title", { default: "Academics" })}
          </h3>
          <p className="text-primary-70">{t("general.academics.lead")}</p>
          <ul className="grid gap-2 sm:grid-cols-2 mt-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="text-primary-70">
                {t(`general.academics.items.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-primary-90">{t("general.politics.title")}</h3>
            <p className="text-primary-70">{t("general.politics.lead")}</p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/about/politics">{t("general.politics.cta")}</Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary-90">{t("hub.browse")}</h2>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(({ key, href, icon: Icon }) => (
          <Card key={key} className="h-full">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary-60" />
                <CardTitle>{t(`links.${key}.title`)}</CardTitle>
              </div>
              <CardDescription>{t(`links.${key}.description`)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary">
                <Link href={href}>{t("hub.cta")}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Org chart */}
      {orgChartUrl && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-primary-90">
            {t("general.orgChart.title", { default: "Organisasjonsstruktur" })}
          </h3>
          <div className="relative w-full overflow-hidden rounded-md border border-primary-10">
            <Image
              src={orgChartUrl}
              alt="BISO org chart"
              width={1600}
              height={900}
              className="w-full h-auto"
            />
          </div>
        </div>
      )}

      {/* National partners */}
      {partners.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-primary-90">
            {t("general.partners.title", { default: "Våre nasjonale partnere" })}
          </h3>
          <div className="grid gap-6 sm:grid-cols-3 items-center">
            {partners.map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-center p-6 rounded-lg border border-primary-10 bg-white"
              >
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      width={300}
                      height={120}
                      className="h-20 w-auto object-contain"
                    />
                  </a>
                ) : (
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    width={300}
                    height={120}
                    className="h-20 w-auto object-contain"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
