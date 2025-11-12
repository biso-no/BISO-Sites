import { UserTable } from "./user-table";
import { getUsers } from "@/app/actions/admin";
import { Suspense } from "react";
import { UserTableSkeleton } from "./user-table-skeleton";

export default async function AdminUsersPage() {
  const users = await getUsers()
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="space-y-6">
        <Suspense fallback={<UserTableSkeleton />}>
          <UserTable initialUsers={users} />
        </Suspense>
      </div>
    </div>
  )
}