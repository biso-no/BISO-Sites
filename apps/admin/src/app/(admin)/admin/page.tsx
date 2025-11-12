import { Suspense } from 'react'
import AdminDashboard from '@/components/dashboard'
import { getPageViews, getUserDistribution, getUserGrowth, getTrafficSources, getRecentActivities, getSystemAlerts, getPostEngagement, getAudienceGrowth, getRevenueByProduct, getExpenseCategories, getJobApplications, getEmployeeDistribution } from '@/lib/actions/admin-dashboard'

export default async function DashboardPage() {
  const [
    pageViews,
    userDistribution,
    userGrowth,
    trafficSources,
    recentActivities,
    systemAlerts,
    postEngagement,
    audienceGrowth,
    revenueByProduct,
    expenseCategories,
    jobApplications,
    employeeDistribution
  ] = await Promise.all([
    getPageViews(),
    getUserDistribution(),
    getUserGrowth(),
    getTrafficSources(),
    getRecentActivities(),
    getSystemAlerts(),
    getPostEngagement(),
    getAudienceGrowth(),
    getRevenueByProduct(),
    getExpenseCategories(),
    getJobApplications(),
    getEmployeeDistribution()
  ])

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminDashboard
        pageViews={pageViews}
        userDistribution={userDistribution}
        userGrowth={userGrowth}
        trafficSources={trafficSources}
        recentActivities={recentActivities}
        systemAlerts={systemAlerts}
        postEngagement={postEngagement}
        audienceGrowth={audienceGrowth}
        revenueByProduct={revenueByProduct}
        expenseCategories={expenseCategories}
        jobApplications={jobApplications}
        employeeDistribution={employeeDistribution}
      />
    </Suspense>
  )
}
