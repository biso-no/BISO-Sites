import { Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { ExpenseApprovers } from "@repo/api/types/appwrite";
import { cache } from "react";
import { getUserAuthContext } from "./authorization";
import type { ExpenseViewer } from "./expense-access";
import { microsoftIdentityEmails } from "./microsoft-identity";
import { ROLES } from "./roles";

/** The signed-in user as the expense permission function sees them. */
export const getExpenseViewer = cache(
  async (): Promise<ExpenseViewer | null> => {
    const ctx = await getUserAuthContext();
    if (!ctx) {
      return null;
    }
    const emails = await loadIdentityEmails();
    const controllerCampusIds = await loadControllerCampusIds(emails);
    return {
      accountEmail: ctx.email,
      controllerCampusIds,
      emails,
      isCampusAdmin: ctx.roles.includes(ROLES.CAMPUS_ADMIN),
      isGlobalAdmin: ctx.roles.includes(ROLES.GLOBAL_ADMIN),
      managedCampusIds: ctx.managedCampusIds,
      name: ctx.name,
      userId: ctx.userId,
    };
  }
);

async function loadIdentityEmails(): Promise<string[]> {
  try {
    const { account } = await createSessionClient();
    const { identities } = await account.listIdentities();
    return microsoftIdentityEmails(identities);
  } catch (error) {
    console.error("[expense-access] identity lookup failed", error);
    return [];
  }
}

async function loadControllerCampusIds(emails: string[]): Promise<string[]> {
  if (emails.length === 0) {
    return [];
  }
  try {
    const { db } = await createAdminClient();
    const { rows } = await db.listRows<ExpenseApprovers>(
      "app",
      "expense_approvers",
      [
        Query.equal("email", emails),
        Query.equal("role", "controller"),
        Query.equal("active", true),
        Query.limit(100),
      ]
    );
    return [
      ...new Set(
        rows
          .map((row) => row.campus_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
  } catch (error) {
    console.error("[expense-access] controller lookup failed", error);
    return [];
  }
}
