import { unauthorized } from "next/navigation";
import { getLoggedInUser } from "@/lib/actions/user";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getLoggedInUser();

  if (!user) {
    unauthorized();
  }

  return <>{children}</>;
}
