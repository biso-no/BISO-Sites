import { createSessionClient } from "../appwrite";
import { Query } from "@repo/api/server";
import { revalidatePath } from "next/cache";

export async function getAccount() {
  const { account } = await createSessionClient();

  return account.get();
}


export async function getUserRoles() {

  const availableRoles = ['Admin', 'pr', 'finance', 'hr', 'users', 'kk'];

const { teams } = await createSessionClient();

const response = await teams.list([
  Query.equal('name', availableRoles),
]);
revalidatePath('/admin/dashboard')
return response.teams.map(team => team.name);
}