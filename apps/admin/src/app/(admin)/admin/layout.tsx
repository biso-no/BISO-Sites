import "@/app/globals.css";
import { redirect } from "next/navigation";
import { getUserRoles } from "@/app/actions/admin";
import { AdminLayout as Component } from "@/components/admin-layout";
import { AdminProviders } from "@/components/layout/admin-providers";
import { fetchNotifications } from "@/lib/actions/notifications";
import { getLoggedInUser } from "@/lib/actions/user";
import { getAuthStatus } from "@/lib/auth-utils";

const allowedRoles = ["Admin", "hr", "finance", "pr"];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // First check if user is authenticated (not anonymous)
  const authStatus = await getAuthStatus();

  if (!authStatus.hasSession || !authStatus.isAuthenticated) {
    return redirect("/auth/login");
  }

  const user = await getLoggedInUser();
  if (!user) {
    return redirect("/auth/login");
  }

  const roles = await getUserRoles();

  if (!allowedRoles.some((role) => roles.includes(role))) {
    return redirect("/unauthorized");
  }

  // Add fallback for when name is undefined
  const firstName = user && user.user.name ? user.user.name.split(" ")[0] : "User";

  // Fetch initial notifications
  const initialNotifications = await fetchNotifications();

  return (
    <AdminProviders initialNotifications={initialNotifications}>
      <Component roles={roles} firstName={firstName || "User"}>
        {children}
      </Component>
    </AdminProviders>
  );
}
