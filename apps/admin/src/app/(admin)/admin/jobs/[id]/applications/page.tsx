import { listJobApplications } from '@/app/actions/jobs'

export default async function AdminJobApplications({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const apps = await listJobApplications(id)
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Applications</h1>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Phone</th>
              <th className="p-3 text-left">Applied</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a: any) => (
              <tr key={a.$id} className="border-t">
                <td className="p-3">{a.applicant_name}</td>
                <td className="p-3">{a.applicant_email}</td>
                <td className="p-3">{a.applicant_phone || '-'}</td>
                <td className="p-3">{a.applied_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
