import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import {
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Mail,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Purchase Terms | BISO",
  description: "Terms of sale, refunds/returns, and delivery information.",
};

const sectionIcons = {
  payment: CreditCard,
  delivery: Truck,
  returns: RotateCcw,
  withdrawal: ShieldCheck,
  contact: Mail,
};

const sectionColors = {
  payment: "from-blue-500 to-cyan-500",
  delivery: "from-green-500 to-emerald-500",
  returns: "from-orange-500 to-amber-500",
  withdrawal: "from-purple-500 to-violet-500",
  contact: "from-brand-gradient-from to-brand-gradient-to",
};

export default async function TermsPage() {
  const t = await getTranslations("terms");

  const sections = [
    "payment",
    "delivery",
    "returns",
    "withdrawal",
    "contact",
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-section to-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-gradient-to via-brand-gradient-from to-brand-gradient-to py-20">
        {/* Animated background elements */}
        <div className="pointer-events-none absolute inset-0">
          <div className="-left-20 absolute top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="-right-20 absolute bottom-10 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
        </div>

        {/* Wave decoration at bottom */}
        <div className="-bottom-1 absolute right-0 left-0">
          <svg
            className="w-full text-background"
            fill="currentColor"
            preserveAspectRatio="none"
            viewBox="0 0 1440 48"
          >
            <path d="M0,48L60,42.7C120,37,240,27,360,26.7C480,27,600,37,720,42.7C840,48,960,48,1080,42.7C1200,37,1320,27,1380,21.3L1440,16L1440,48L1380,48C1320,48,1200,48,1080,48C960,48,840,48,720,48C600,48,480,48,360,48C240,48,120,48,60,48L0,48Z" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
          <Badge className="mb-6 border-white/20 bg-white/10 px-4 py-1.5 text-white backdrop-blur-sm">
            <FileText className="mr-2 h-4 w-4" />
            {t("badge")}
          </Badge>
          <h1 className="mb-4 font-bold text-4xl text-white md:text-5xl">
            {t("title")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/80">
            {t("intro")}
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 text-sm text-white/60">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t("lastUpdated")}
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {t("version")}
            </span>
          </div>
        </div>
      </section>

      {/* Content Grid */}
      <section className="-mt-8 relative z-10 mx-auto max-w-5xl px-4 pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          {sections.map((sectionKey, _index) => {
            const Icon = sectionIcons[sectionKey];
            const gradient = sectionColors[sectionKey];

            return (
              <Card
                className={`group relative overflow-hidden border-0 p-0 shadow-lg transition-all duration-300 hover:shadow-xl ${
                  sectionKey === "contact" ? "md:col-span-2" : ""
                }`}
                key={sectionKey}
              >
                {/* Section gradient header */}
                <div
                  className={`bg-gradient-to-r ${gradient} relative h-2 w-full`}
                />

                <div className="p-6">
                  <div className="mb-4 flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-foreground text-xl">
                        {t(`sections.${sectionKey}.title`)}
                      </h2>
                      <Badge
                        className="mt-1 text-muted-foreground text-xs"
                        variant="outline"
                      >
                        {t(`sections.${sectionKey}.badge`)}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-muted-foreground leading-relaxed">
                    {t(`sections.${sectionKey}.body`)}
                  </p>

                  {/* Highlight box for important info */}
                  {t.raw(`sections.${sectionKey}.highlight`) && (
                    <div className="mt-4 rounded-lg bg-brand-muted p-4 dark:bg-brand-muted-strong">
                      <p className="text-brand-dark text-sm dark:text-brand">
                        {t(`sections.${sectionKey}.highlight`)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Hover glow effect */}
                <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 shadow-[inset_0_0_40px_rgba(61,169,224,0.05)] transition-opacity duration-300 group-hover:opacity-100" />
              </Card>
            );
          })}
        </div>

        {/* Footer CTA */}
        <Card className="mt-8 border-0 bg-gradient-to-r from-brand-muted to-brand-muted-strong p-8 text-center shadow-lg dark:from-brand-muted dark:to-brand-muted-strong">
          <h3 className="mb-2 font-bold text-foreground text-xl">
            {t("footer.title")}
          </h3>
          <p className="mb-4 text-muted-foreground">
            {t("footer.description")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              className="flex items-center gap-2 font-medium text-brand hover:underline"
              href="mailto:contact@biso.no"
            >
              <Mail className="h-4 w-4" />
              contact@biso.no
            </Link>
            <Link
              className="flex items-center gap-2 font-medium text-brand hover:underline"
              href="/privacy"
            >
              <ShieldCheck className="h-4 w-4" />
              {t("footer.privacyPolicy")}
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
