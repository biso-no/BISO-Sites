import { ImageWithFallback } from "@repo/ui/components/image";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Check, Download, Mail, Newspaper, X } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AboutHero } from "@/components/about/about-hero";

const PRESS_EMAIL = "contact@biso.no";
const SECTION_SHELL = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

interface PressAsset {
  /** File facts shown under the name, e.g. "PNG, 865 × 865 px". */
  details: string;
  href: string;
  imageClassName: string;
  key: "logoLight" | "logoDark" | "orgChart";
  /** The preview sits on the background the file is meant for. */
  previewClassName: string;
}

const ASSETS: PressAsset[] = [
  {
    key: "logoLight",
    href: "/images/logo-light.png",
    details: "PNG, 865 × 865 px",
    previewClassName: "bg-white",
    imageClassName: "object-contain p-10",
  },
  {
    key: "logoDark",
    href: "/images/logo-dark.png",
    details: "PNG, 865 × 865 px",
    previewClassName: "bg-nav-background",
    imageClassName: "object-contain p-10",
  },
  {
    key: "orgChart",
    href: "/images/org-chart.png",
    details: "PNG, 1024 × 694 px",
    previewClassName: "bg-white",
    imageClassName: "object-contain p-4",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("press.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function PressPage() {
  const t = await getTranslations("press");
  const doItems = t.raw("usage.do") as string[];
  const dontItems = t.raw("usage.dont") as string[];

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <AboutHero
        breadcrumbs={[
          { label: t("breadcrumbHome"), href: "/" },
          { label: t("title") },
        ]}
        compact
        icon={<Newspaper className="h-8 w-8 text-white" />}
        subtitle={t("subtitle")}
        title={t("title")}
      />

      <section className="py-16" id="about-content">
        <div className={SECTION_SHELL}>
          <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-center">
            <div className="max-w-2xl">
              <h2 className="font-bold text-2xl text-foreground md:text-3xl">
                {t("intro.title")}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                {t("intro.body")}
              </p>
            </div>

            <Card className="border-brand-border bg-card/80 p-6 shadow-lg backdrop-blur-sm">
              <h3 className="font-semibold text-foreground text-lg">
                {t("contact.title")}
              </h3>
              <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                {t("contact.body")}
              </p>
              <a
                className="mt-3 inline-block font-semibold text-brand text-lg underline-offset-4 hover:underline"
                href={`mailto:${PRESS_EMAIL}`}
              >
                {PRESS_EMAIL}
              </a>
              <Button
                asChild
                className="mt-6 w-full bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white shadow-md hover:opacity-90"
                size="lg"
              >
                <a href={`mailto:${PRESS_EMAIL}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  {t("contact.cta")}
                </a>
              </Button>
            </Card>
          </div>
        </div>
      </section>

      <section className="bg-section/50 py-16">
        <div className={SECTION_SHELL}>
          <div className="mb-10 max-w-3xl">
            <h2 className="font-bold text-2xl text-foreground md:text-3xl">
              {t("assets.title")}
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              {t("assets.lead")}
            </p>
          </div>

          <ul className="grid gap-6 md:grid-cols-3">
            {ASSETS.map((asset) => {
              const name = t(`assets.${asset.key}`);
              return (
                <li key={asset.key}>
                  <Card className="h-full gap-0 overflow-hidden border-border/50 p-0">
                    <div
                      className={`relative aspect-4/3 border-border/50 border-b ${asset.previewClassName}`}
                    >
                      <ImageWithFallback
                        alt=""
                        className={asset.imageClassName}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        src={asset.href}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 p-5">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground">
                          {name}
                        </h3>
                        <p className="mt-1 text-muted-foreground text-sm">
                          {asset.details}
                        </p>
                      </div>
                      <Button
                        asChild
                        className="shrink-0 border-brand-border text-brand hover:bg-brand-muted"
                        size="sm"
                        variant="outline"
                      >
                        <a
                          aria-label={t("assets.downloadAria", { name })}
                          download
                          href={asset.href}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          {t("assets.download")}
                        </a>
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="py-16">
        <div className={SECTION_SHELL}>
          <h2 className="mb-10 font-bold text-2xl text-foreground md:text-3xl">
            {t("usage.title")}
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border/50 bg-card/80 p-6">
              <h3 className="font-semibold text-foreground text-lg">
                {t("usage.doTitle")}
              </h3>
              <ul className="mt-4 space-y-3">
                {doItems.map((item) => (
                  <li className="flex items-start gap-3" key={item}>
                    <Check
                      aria-hidden
                      className="mt-0.5 h-5 w-5 shrink-0 text-brand"
                    />
                    <span className="text-muted-foreground leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="border-border/50 bg-card/80 p-6">
              <h3 className="font-semibold text-foreground text-lg">
                {t("usage.dontTitle")}
              </h3>
              <ul className="mt-4 space-y-3">
                {dontItems.map((item) => (
                  <li className="flex items-start gap-3" key={item}>
                    <X
                      aria-hidden
                      className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                    />
                    <span className="text-muted-foreground leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <p className="mt-8 text-muted-foreground">
            {t("usage.note")}{" "}
            <a
              className="font-medium text-brand underline-offset-4 hover:underline"
              href={`mailto:${PRESS_EMAIL}`}
            >
              {PRESS_EMAIL}
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
