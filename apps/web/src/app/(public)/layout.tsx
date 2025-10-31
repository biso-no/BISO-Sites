import "@/app/globals.css";

import { AssistantModal } from "@/components/ai/public";
import { PublicProviders } from "@/components/layout/public-providers";
import { Footer } from "@/lib/components/Footer";
import { Header } from "@/lib/components/Header";

// Anonymous session is now handled automatically by middleware
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicProviders>
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-surface opacity-[0.35]" />
        <div
          aria-hidden
          className="pointer-events-none absolute left-[-20%] top-[-35%] h-[32rem] w-[32rem] rounded-full bg-brand-hero opacity-60 blur-[180px] sm:left-[5%] sm:h-[36rem] sm:w-[36rem]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-[-25%] right-[-10%] h-[28rem] w-[28rem] rounded-full bg-gold-muted/60 blur-[180px]"
        />

        <Header editMode={false} />

        <main className="relative z-10 flex-1 pb-20 pt-8 sm:pt-10 lg:pb-28">
          <div className="container mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
          <div className="pointer-events-none absolute inset-x-[10%] bottom-0 mx-auto h-48 max-w-5xl rounded-full bg-linear-to-t from-primary/10 via-transparent to-transparent" />
        </main>

        <AssistantModal />

        <Footer className="relative z-10 border-t border-primary/10 bg-white/85 backdrop-blur">
          <Footer.List title="Explore">
            <Footer.Link href="/jobs">Jobs</Footer.Link>
            <Footer.Link href="/events">Events</Footer.Link>
            <Footer.Link href="/shop">Shop</Footer.Link>
            <Footer.Link href="/news">News</Footer.Link>
            <Footer.Link href="/units">Units</Footer.Link>
          </Footer.List>
          <Footer.List title="Campuses">
            <Footer.Link href="/campus?campus=oslo">Oslo</Footer.Link>
            <Footer.Link href="/campus?campus=bergen">Bergen</Footer.Link>
            <Footer.Link href="/campus?campus=trondheim">Trondheim</Footer.Link>
            <Footer.Link href="/campus?campus=stavanger">Stavanger</Footer.Link>
          </Footer.List>
          <Footer.List title="About BISO">
            <Footer.Link href="/about">About BISO</Footer.Link>
            <Footer.Link href="/partner">Become a Partner</Footer.Link>
            <Footer.Link href="/contact">Contact</Footer.Link>
            <Footer.Link href="/privacy">Privacy</Footer.Link>
          </Footer.List>
        </Footer>
      </div>
    </PublicProviders>
  );
}
