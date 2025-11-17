import type { Metadata } from 'next';
import { museoSans, inter } from "./fonts";
import Providers from "./providers"
import '@/app/globals.css';
import {NextIntlClientProvider} from 'next-intl';
import {getLocale} from '@/app/actions/locale';
import {getMessages} from 'next-intl/server';
import { AnalyticsTracker } from '@/components/analytics-tracker';
export const metadata: Metadata = {
  title: 'BI Student Organisation',
  description: 'BISO Apps',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favico.png', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
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
    <html lang={locale} className={`${museoSans.variable} ${inter.variable}`}>

      <body>
        <Providers>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <main>
            <AnalyticsTracker locale={locale} />
            {children}
          </main>
        </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}

export const dynamic = 'force-dynamic';
