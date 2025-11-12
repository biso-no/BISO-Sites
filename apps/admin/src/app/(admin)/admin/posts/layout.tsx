import { getUserRoles } from '@/app/actions/admin'
import { redirect } from 'next/navigation'

export default async function PostsLayout({ children }: { children: React.ReactNode }) {
  const roles = await getUserRoles()
  const allowed = ['Admin', 'pr']
  const hasAccess = roles.includes('Admin') || roles.some(r => allowed.includes(r))
  if (!hasAccess) {
    return redirect('/admin')
  }
  return <>{children}</>
}


