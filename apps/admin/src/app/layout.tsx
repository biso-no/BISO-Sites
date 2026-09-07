import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { getLocale } from "@/app/actions/locale";
import { inter, museoSans } from "./fonts";
import Providers from "./providers";
import "@/app/styles.css";

export const metadata: Metadata = {
  title: "BI Student Organisation",
  description: "BISO Apps",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/favico.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
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
    // suppressHydrationWarning added here 👇
    <html
      className={`${GeistSans.variable} ${museoSans.variable} ${inter.variable}`}
      lang={locale}
      suppressHydrationWarning
    >
      <body>
        <Providers>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <main>
              {children}
              <Script
                data-website-id="fb30735f-bf07-409f-bc65-f32baf0b17fd"
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

export const dynamic = "force-dynamic";
