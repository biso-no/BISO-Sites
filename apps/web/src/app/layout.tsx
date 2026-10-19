import { getLocale } from "@/app/actions/locale";
import "@/app/styles.css";
import type { Metadata } from "next";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Suspense } from "react";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { BiSignInNotice } from "@/components/bi-sign-in-notice";
import { UmamiBeforeSend } from "@/components/umami-before-send";
import { UMAMI_BEFORE_SEND } from "@/lib/analytics-privacy";
import { inter, museoSans, museoSlab } from "./fonts";
import Providers from "./providers";
export const metadata: Metadata = {
  title: "BI Student Organisation",
  description: "BISO Apps",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "https://biso.no"),
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
    <html
      className={`${museoSans.variable} ${museoSlab.variable} ${inter.variable} biso-surface`}
      lang={locale}
      suppressHydrationWarning
    >
      <body>
        <Providers>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <main>
              <AnalyticsTracker locale={locale} />
              {/* Reads `?link_error=`, so it needs a Suspense boundary — this
                  layout is not force-dynamic. Renders nothing either way. */}
              <Suspense fallback={null}>
                <BiSignInNotice />
              </Suspense>
              {children}
              {/* Drops the query string from `/auth/` page URLs before Umami
                  records them: `/auth/verify` carries a live sign-in secret. */}
              <UmamiBeforeSend />
              <Script
                data-before-send={UMAMI_BEFORE_SEND}
                data-domains="biso.no,biso.no,www.biso.no"
                data-performance="true"
                data-website-id="ada2c233-ee4f-4064-87c0-feaeb52c56ce"
                defer
                src="https://analytics.biso.no/script.js"
                strategy="afterInteractive"
              />
            </main>
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
