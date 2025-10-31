import { getDepartments, getDepartmentTypes, type Department } from '@/lib/admin/departments'
import { UnitsPageClient } from './units-page-client'

export const revalidate = 0

type PageSearchParams = Promise<Record<string, string | undefined>>

type InitialFilters = {
  campusId: string | null
  type: string | null
  search: string
  showInactive: boolean
}

export default async function PublicUnitsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams

  const [departments, types] = await Promise.all([
    getDepartments({ limit: 500 }),
    getDepartmentTypes()
  ])

  const initialFilters: InitialFilters = {
    campusId: params.campus_id && params.campus_id !== 'all' ? params.campus_id : null,
    type: params.type && params.type !== 'all' ? params.type : null,
    search: params.search ?? '',
    showInactive: params.status === 'inactive'
  }

  return (
    <UnitsPageClient
      departments={Array.isArray(departments) ? (departments as Department[]) : []}
      types={Array.isArray(types) ? (types as string[]) : []}
      initialFilters={initialFilters}
    />
  )
}
