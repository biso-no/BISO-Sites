import { Query } from "@repo/api/client";
import { createAdminClient } from "@repo/api/server";

export async function GET(_req: Request) {
  const { users } = await createAdminClient();

  const todaysDate = new Date();
  todaysDate.setHours(0, 0, 0, 0);

  const twoWeeksAgo = new Date(todaysDate.getTime() - 14 * 24 * 60 * 60 * 1000);

  const anonUsers = await users.list({
    queries: [
      Query.equal("emailVerification", false),
      Query.isNull("email"),
      Query.updatedBefore(twoWeeksAgo.toISOString()),
      Query.limit(5000),
    ],
  });

  const deletedUsers = await Promise.all(
    anonUsers.users.map((user) => users.delete(user.$id))
  );

  if (deletedUsers.length > 0) {
    console.log(`Deleted ${deletedUsers.length} anonymous users`);
  }
  return Response.json(`Deleted ${deletedUsers.length} anonymous users`);
}
