import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  Building2,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Send,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCampuses } from "@/app/actions/campus";

export const metadata: Metadata = {
  title: "Contact | BISO",
  description: "Contact BISO nationally or at your campus.",
};

export default async function ContactPage() {
  const [t, campuses] = await Promise.all([
    getTranslations("contact"),
    getCampuses(),
  ]);

  const filteredCampuses = campuses.filter(
    (c) => c.name?.toLowerCase() !== "national"
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to py-20 text-white sm:py-28">
        <div className="absolute inset-0 bg-linear-to-t from-brand-overlay-from/70 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_50%),radial-gradient(circle_at_bottom_right,rgba(61,169,224,0.15),transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-6 border-white/30 bg-white/10 text-white backdrop-blur-sm">
              <MessageCircle className="mr-2 h-3.5 w-3.5" />
              {t("title")}
            </Badge>
            <h1 className="mb-6 font-bold text-4xl leading-tight sm:text-5xl lg:text-6xl">
              {t("title")}
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-white/85 leading-relaxed">
              {t("intro")}
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* National Contact Card */}
        <section className="mb-16">
          <Card className="relative overflow-hidden border-0 bg-linear-to-br from-violet-50 via-violet-50/50 to-white p-8 shadow-lg dark:from-violet-950/30 dark:via-violet-950/10 dark:to-card sm:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-violet-700 shadow-lg">
                  <Globe className="h-7 w-7 text-white" />
                </div>
                <div>
                  <Badge className="mb-2" variant="secondary">
                    {t("national.title")}
                  </Badge>
                  <h2 className="mb-2 font-bold text-foreground text-xl sm:text-2xl">
                    {t("national.title")}
                  </h2>
                  <p className="max-w-xl text-muted-foreground">
                    {t("national.body")}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <Button asChild size="lg">
                  <a href="mailto:post@bfriso.no">
                    <Mail className="mr-2 h-4 w-4" />
                    contact@biso.no
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/about">
                    <Building2 className="mr-2 h-4 w-4" />
                    About BISO
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        </section>

        {/* Campus Contacts */}
        <section>
          <div className="mb-10 text-center">
            <Badge className="mb-4" variant="secondary">
              <MapPin className="mr-2 h-3 w-3" />
              Campus Contacts
            </Badge>
            <h2 className="mb-3 font-bold text-2xl text-foreground sm:text-3xl">
              {t("campuses.title") || "Contact Your Campus"}
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              {t("campuses.subtitle") ||
                "Reach out to your local BISO campus for campus-specific inquiries and support."}
            </p>
          </div>

          {filteredCampuses.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {filteredCampuses.map((campus, index) => {
                const colorSchemes = [
                  {
                    gradient:
                      "from-blue-50 via-blue-50/50 to-white dark:from-blue-950/30 dark:via-blue-950/10 dark:to-card",
                    iconGradient: "from-blue-500 to-blue-700",
                  },
                  {
                    gradient:
                      "from-emerald-50 via-emerald-50/50 to-white dark:from-emerald-950/30 dark:via-emerald-950/10 dark:to-card",
                    iconGradient: "from-emerald-500 to-emerald-700",
                  },
                  {
                    gradient:
                      "from-orange-50 via-orange-50/50 to-white dark:from-orange-950/30 dark:via-orange-950/10 dark:to-card",
                    iconGradient: "from-orange-500 to-amber-600",
                  },
                  {
                    gradient:
                      "from-pink-50 via-pink-50/50 to-white dark:from-pink-950/30 dark:via-pink-950/10 dark:to-card",
                    iconGradient: "from-pink-500 to-rose-600",
                  },
                ];
                const colors = colorSchemes[index % colorSchemes.length];

                return (
                  <Card
                    className={`group relative h-full border-0 bg-linear-to-br p-6 shadow-lg transition-all hover:shadow-xl ${colors.gradient}`}
                    key={campus.$id}
                  >
                    <div
                      className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br shadow-md ${colors.iconGradient}`}
                    >
                      <MapPin className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="mb-3 font-semibold text-foreground text-lg">
                      {campus.name}
                    </h3>
                    {campus.email ? (
                      <a
                        className="group/link inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-primary"
                        href={`mailto:${campus.email}`}
                      >
                        <Mail className="h-4 w-4" />
                        <span className="underline-offset-2 group-hover/link:underline">
                          {campus.email}
                        </span>
                      </a>
                    ) : (
                      <p className="text-muted-foreground/60 text-sm">
                        No email available
                      </p>
                    )}
                    {campus.email && (
                      <Button
                        asChild
                        className="mt-4 w-full"
                        size="sm"
                        variant="secondary"
                      >
                        <a href={`mailto:${campus.email}`}>
                          <Send className="mr-2 h-3.5 w-3.5" />
                          Send Email
                        </a>
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed p-12 text-center">
              <MapPin className="mx-auto mb-4 h-8 w-8 text-muted-foreground/50" />
              <p className="text-muted-foreground">{t("campuses.empty")}</p>
            </Card>
          )}
        </section>

        {/* Additional Help Section */}
        <section className="mt-16">
          <Card className="relative overflow-hidden border-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to p-8 text-white shadow-xl sm:p-10">
            <div className="absolute inset-0 bg-linear-to-t from-brand-overlay-from/50 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_50%)]" />
            <div className="relative flex flex-col items-center gap-6 text-center lg:flex-row lg:justify-between lg:text-left">
              <div>
                <h2 className="mb-2 font-bold text-xl text-white sm:text-2xl">
                  Need more help?
                </h2>
                <p className="max-w-xl text-white/80">
                  Check out our FAQ section or browse our about pages to learn
                  more about BISO and how we can help you.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  className="bg-white text-primary-100 shadow-lg hover:bg-white/90"
                  size="lg"
                >
                  <Link href="/membership">Membership FAQ</Link>
                </Button>
                <Button
                  asChild
                  className="border-white/30 text-white hover:bg-white/10"
                  size="lg"
                  variant="outline"
                >
                  <Link href="/about">About BISO</Link>
                </Button>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
