import { getUserRoles } from '@/app/actions/admin'
import { redirect } from 'next/navigation'

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  const roles = await getUserRoles()
  const allowed = ['Admin', 'hr', 'finance']
  const hasAccess = roles.includes('Admin') || roles.some(r => allowed.includes(r))
  if (!hasAccess) {
    return redirect('/admin')
  }
  return <>{children}</>
}


