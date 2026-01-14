import { Query } from "@repo/api/client";
import { createAdminClient } from "@repo/api/server"

export async function GET(req: Request) {

    const { users } = await createAdminClient();

    const todaysDate = new Date();
    todaysDate.setHours(0, 0, 0, 0);

    const twoWeeksAgo = new Date(todaysDate.getTime() - 14 * 24 * 60 * 60 * 1000);

    const anonUsers = await users.list({
        queries: [
            Query.equal("emailVerification", false),
            Query.isNull("email"),
            Query.updatedBefore(twoWeeksAgo.toISOString()),
            Query.limit(5000)
        ]
    })

    const deletedUsers = await Promise.all(anonUsers.users.map(user => users.delete(user.$id)))

    console.log(deletedUsers)
    return Response.json(deletedUsers)
}

