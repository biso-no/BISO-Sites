import { AssistantProvider } from "components/assistant/assistant-context";
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
        {/* Outside RootProvider, so anything Fumadocs renders beside the page
            can reach the assistant. Its search dialog doesn't yet: in
            fumadocs-ui 16.7.10 the dialog's footer slot renders outside the
            dialog, so an ask item there can't be reached. */}
        <AssistantProvider>
          <RootProvider>{children}</RootProvider>
        </AssistantProvider>
      </body>
    </html>
  );
}
