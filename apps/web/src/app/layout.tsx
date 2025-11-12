import { museoSans, inter } from "./fonts";
import Providers from "./providers"
import '@/app/globals.css';
import {NextIntlClientProvider} from 'next-intl';
import {getLocale} from '@/app/actions/locale';
import {getMessages} from 'next-intl/server';

export const metadata = {
  title: 'BI Student Organisation',
  description: 'BISO Apps',
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
            {children}
          </main>
        </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}

export const dynamic = 'force-dynamic';
