import '@/app/globals.css';
import { AdminLayout as Component } from '@/components/admin-layout';
import { getUserRoles } from '@/app/actions/admin';
import { getLoggedInUser } from '@/lib/actions/user';
import { AdminProviders } from '@/components/layout/admin-providers';
import { getAuthStatus } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // First check if user is authenticated (not anonymous)
  const authStatus = await getAuthStatus();
  
  if (!authStatus.hasSession || !authStatus.isAuthenticated) {
    return redirect('/auth/login')
  }

  const user = await getLoggedInUser()
  if (!user) {
    return redirect('/auth/login')
  }

  const roles = await getUserRoles()
  console.log("User object:", user)
  
  // Add fallback for when name is undefined
  const firstName = user && user.user.name ? user.user.name.split(' ')[0] : 'User'

  return (
    <AdminProviders>
    <Component roles={roles} firstName={firstName}>
    {children}
    </Component>
    </AdminProviders>
  );
}
