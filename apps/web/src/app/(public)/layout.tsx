import { Footer } from "@/components/layout/footer";
import { Navigation } from "@/components/layout/nav";
import { PublicProviders } from "@/components/layout/public-providers";
import { getMembershipStatus } from "@/lib/actions/membership";

// Anonymous session is now handled automatically by middleware
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch membership status on the server (uses cookie cache)
  const membershipStatus = await getMembershipStatus();

  return (
    <PublicProviders initialMembershipStatus={membershipStatus}>
      <Navigation />
      <main>
        <div>{children}</div>
      </main>
      <Footer />
    </PublicProviders>
  );
}
