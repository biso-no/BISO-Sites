import { getLoggedInUser } from "@/lib/actions/user";
import { unauthorized } from "next/navigation";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getLoggedInUser();
  
  if (!user) {
    unauthorized();
  }
  
  return <>
            {children}
        </>;
}