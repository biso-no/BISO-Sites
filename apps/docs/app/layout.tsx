import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import "./global.css";
import { inter, museoSans } from "./fonts";

export const metadata: Metadata = {
  title: "BISO Docs",
  description: "Documentation for BISO Apps",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://docs.biso.no"
  ),
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/favico.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      className={`${museoSans.variable} ${inter.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
