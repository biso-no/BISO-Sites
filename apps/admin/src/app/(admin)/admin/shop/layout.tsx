import { getUserRoles } from '@/app/actions/admin'
import { redirect } from 'next/navigation'

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const roles = await getUserRoles()
  const allowed = ['Admin', 'finance']
  const hasAccess = roles.includes('Admin') || roles.some(r => allowed.includes(r))
  if (!hasAccess) {
    return redirect('/admin')
  }
  return <>{children}</>
}


