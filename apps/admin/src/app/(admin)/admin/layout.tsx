import '@/app/globals.css';
import { AdminLayout as Component } from '@/components/admin-layout';
import { getUserRoles } from '@/app/actions/admin';
import { getLoggedInUser } from '@/lib/actions/user';
import { AdminProviders } from '@/components/layout/admin-providers';
import { getAuthStatus } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';
import { fetchNotifications } from '@/lib/actions/notifications';

const allowedRoles = ['Admin', 'hr', 'finance', 'pr']

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

  if (!allowedRoles.some(role => roles.includes(role))) {
    return redirect('/unauthorized')
  }
  
  // Add fallback for when name is undefined
  const firstName = user && user.user.name ? user.user.name.split(' ')[0] : 'User'

  // Fetch initial notifications
  const initialNotifications = await fetchNotifications()

  return (
    <AdminProviders initialNotifications={initialNotifications}>
      <Component roles={roles} firstName={firstName || 'User'}>
        {children}
      </Component>
    </AdminProviders>
  );
}
