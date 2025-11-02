import "@/app/globals.css";

import { AssistantModal } from "@/components/ai/public";
import { PublicProviders } from "@/components/layout/public-providers";
import { Footer } from "@/lib/components/Footer";
import { Header } from "@/lib/components/Header";

// Anonymous session is now handled automatically by middleware
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicProviders>
      <div className="relative flex min-h-screen flex-col bg-background">

        <Header editMode={false} />

        <main className="relative z-10 flex-1 pb-16 pt-8 sm:pt-10 lg:pb-20">
          <div className="container-page flex flex-col gap-10">
            {children}
          </div>
        </main>

        <AssistantModal />

        <Footer className="relative z-10 border-t border-border bg-background">
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
