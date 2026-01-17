import { redirect } from "next/navigation";
import { getUserRoles } from "@/app/actions/admin";
import { AdminLayout as Component } from "@/components/admin-layout";
import { AdminProviders } from "@/components/layout/admin-providers";
import { fetchNotifications } from "@/lib/actions/notifications";
import { getLoggedInUser } from "@/lib/actions/user";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if user is authenticated (has a tenant account)
  const user = await getLoggedInUser();

  if (!user) {
    return redirect("/auth/login");
  }

  // Fetch user roles and notifications in parallel
  const rolesPromise = getUserRoles();
  const notificationsPromise = fetchNotifications();

  const [roles, initialNotifications] = await Promise.all([
    rolesPromise,
    notificationsPromise,
  ]);

  // Add fallback for when name is undefined
  const firstName = user?.user.name ? user.user.name.split(" ")[0] : "User";

  return (
    <AdminProviders initialNotifications={initialNotifications}>
      <Component firstName={firstName || "User"} roles={roles}>
        {children}
      </Component>
    </AdminProviders>
  );
}
