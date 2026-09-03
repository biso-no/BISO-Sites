import type { Metadata } from "next";
import { archivo, inter } from "./fonts";
import Providers from "./providers";
import "@/app/styles.css";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { AccountLinkSessionCleanup } from "@/components/account-link-session-cleanup";
import { AnalyticsTracker } from "@/components/analytics-tracker";
export const metadata: Metadata = {
  title: "BI Student Organisation",
  description:
    "BISO is the student organisation at BI Norwegian Business School — events, volunteer roles, student benefits and campus life across Oslo, Bergen, Trondheim and Stavanger.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://web.biso.no"
  ),
  icons: {
    icon: [{ url: "/favico.png" }, { url: "/favico.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    siteName: "BI Student Organisation",
    type: "website",
    locale: "no_NO",
    // TODO: replace with a purpose-built 1200x630 og-default.png
    images: [
      { url: "/images/hero-bg.png", width: 1200, height: 630, alt: "BISO" },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    // `biso-surface` carries the legacy palette that unmigrated components
    // still read; `biso-surface-v2` adds the redesign tokens beside it. Both are
    // mounted during the migration so old and new components render correctly on
    // the same page. apps/admin mounts only `biso-surface` and is unaffected.
    // RD-030 drops the legacy class once nothing reads its tokens.
    <html
      className={`${archivo.variable} ${inter.variable} biso-surface biso-surface-v2`}
      lang={locale}
      suppressHydrationWarning
    >
      <body>
        <Providers>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {/* No <main> here. This layout wraps every route group, so a <main>
                at this level swallowed the whole page — including SiteShell's
                own <main>, its <nav> and its <footer>. Every page rendered two
                nested <main> elements with the banner and contentinfo landmarks
                buried inside the first (00-current-state.md §8.2).
                Each route group now owns exactly one <main>: SiteShell for
                (public) and (protected), (auth)/layout.tsx for the login tree,
                and not-found/unauthorized supply their own. */}
            <AnalyticsTracker locale={locale} />
            {/* Reads `?linked=1`, so it needs a Suspense boundary — this
                layout is not force-dynamic. Renders nothing either way. */}
            <Suspense fallback={null}>
              <AccountLinkSessionCleanup />
            </Suspense>
            {children}
            <Script
              data-domains="web.biso.no,biso.no,www.biso.no"
              data-performance="true"
              data-website-id="ada2c233-ee4f-4064-87c0-feaeb52c56ce"
              defer
              src="https://analytics.biso.no/script.js"
              strategy="afterInteractive"
            />
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}

// Next 16.3 cacheComponents escape hatch: routes here read cookies
// (locale/campus prefs) at the top level, so they cannot produce a static
// shell yet. `instant = false` permits blocking dynamic routes at build time.
// Follow-up: move cookie reads behind Suspense boundaries per route, then
// remove this to get static shells + working partial prefetching.
export const instant = false;
