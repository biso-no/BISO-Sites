import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import "./global.css";
import { museoSans, museoSlab } from "./fonts";

export const metadata: Metadata = {
  title: { default: "BISO Docs", template: "%s | BISO Docs" },
  description: "How to use the BISO platform, and how to keep it running.",
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
      className={`${museoSans.variable} ${museoSlab.variable} biso-surface biso-surface-v2`}
      lang="en"
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
