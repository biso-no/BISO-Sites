import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ArrowLeft, Home, SearchX } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <main
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center overflow-hidden",
        "bg-linear-to-br from-brand-gradient-to via-brand to-brand-gradient-from text-white"
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_55%),radial-gradient(circle_at_bottom_right,var(--brand-muted),transparent_60%)]" />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
        <div className="flex items-center gap-3 rounded-full border border-white/20 bg-background/10 px-4 py-2 text-xs uppercase tracking-[0.2em]">
          <SearchX className="h-4 w-4" />
          <span>{t("notFound.tagline")}</span>
        </div>

        <div className="space-y-4">
          <p className="font-medium text-sm text-white/70 uppercase tracking-[0.25em]">
            404
          </p>
          <h1 className="max-w-xl font-semibold text-4xl text-white leading-tight md:text-5xl">
            {t('notFound.title')}
          </h1>
          <p className="max-w-2xl text-base text-white/80 md:text-lg">
            {t('notFound.description')}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            className="bg-background text-foreground hover:bg-background/90"
            size="lg"
          >
            <Link href="/">
              <Home className="mr-2 h-5 w-5" />
              {t('notFound.cta.goToFrontPage')}
            </Link>
          </Button>
          <Button
            asChild
            className="border border-white/40 bg-background/10 text-white hover:bg-background/20"
            size="lg"
            variant="ghost"
          >
            <Link href="/campus">
              <ArrowLeft className="mr-2 h-5 w-5" />
              {t('notFound.cta.goToCampus')}
            </Link>
          </Button>
        </div>

        <div className="rounded-3xl border border-white/15 bg-background/10 px-6 py-4 text-sm text-white/80 shadow-lg">
          <p>
            {t.rich("notFound.cta.needAssistance", {
              email: "contact@biso.no",
              link: (chunks) => (
                <a
                  className="font-semibold underline-offset-4 hover:underline"
                  href="mailto:contact@biso.no"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
      </div>
    </main>
  );
}
