import { Suspense } from "react";
import { getUsers } from "@/app/actions/admin";
import { UserTable } from "./user-table";
import { UserTableSkeleton } from "./user-table-skeleton";

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="space-y-6">
        <Suspense fallback={<UserTableSkeleton />}>
          <UserTable initialUsers={users} />
        </Suspense>
      </div>
    </div>
  );
}
