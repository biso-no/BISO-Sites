import { Suspense } from 'react'
import AdminDashboard from '@/components/dashboard'
import { getDashboardMetrics } from '@/lib/actions/admin-dashboard'

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics()

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminDashboard {...metrics} />
    </Suspense>
  )
}