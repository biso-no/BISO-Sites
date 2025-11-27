import { AssistantModal } from "@/components/ai/public";
import { Footer } from "@/components/layout/footer";
import { Navigation } from "@/components/layout/nav";
import { PublicProviders } from "@/components/layout/public-providers";

// Anonymous session is now handled automatically by middleware
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicProviders>
      <Navigation />
      <main>
        <div>{children}</div>
      </main>
      <AssistantModal />
      <Footer />
    </PublicProviders>
  );
}
