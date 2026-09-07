import { Home, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SignInLink } from "@/components/auth/sign-in-link";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.unauthorized");
  return { title: `${t("tagline")} | BISO`, description: t("description") };
}

/**
 * The 401 surface for `(protected)` — what `unauthorized()` in
 * `(protected)/layout.tsx` renders. It replaces the whole segment, so it draws
 * its own `<main>` and there is no site chrome around it.
 *
 * **It was hardcoded Norwegian, and the translations already existed.** The
 * same six strings, in both locales, sat in `adminPortal.unauthorized` serving
 * `apps/admin`'s own 401 page. They are copied verbatim to
 * `common.unauthorized` and read from there; admin keeps its own namespace.
 *
 * A Server Component now. It was a Client Component to pick a logo from
 * `useTheme()` behind a `mounted` flag — so every visitor saw a pulsing grey
 * rectangle first. Two `<Image>`s and `dark:` do that with no flash, and the
 * one genuinely client-side part, the refused path, is an island.
 */
export default async function Unauthorized() {
  const t = await getTranslations("common.unauthorized");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-16 text-ink">
      <div className="flex w-full max-w-(--measure) flex-col items-center gap-8 text-center">
        <Image
          alt="BISO"
          className="h-12 w-auto dark:hidden"
          height={48}
          priority
          src="/images/logo-light.png"
          width={160}
        />
        <Image
          alt="BISO"
          className="hidden h-12 w-auto dark:block"
          height={48}
          priority
          src="/images/logo-dark.png"
          width={160}
        />

        <div className="flex flex-col items-center gap-5">
          <ShieldAlert aria-hidden="true" className="size-10 text-danger" />
          <p className="type-label text-ink-muted">401 · {t("tagline")}</p>
          <h1 className="type-display-sm break-words text-ink">{t("title")}</h1>
          <p className="type-body text-ink-muted">{t("description")}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <SignInLink label={t("signIn")} />
          <Link
            className="type-label inline-flex items-center gap-2 rounded-biso-pill border border-edge px-5 py-3 text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            href="/"
          >
            <Home aria-hidden="true" className="size-4 shrink-0" />
            {t("goToFrontPage")}
          </Link>
        </div>

        <p className="type-body-sm text-ink-muted">
          {t.rich("help", {
            link: (chunks) => (
              <a
                className="text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                href="mailto:contact@biso.no"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
