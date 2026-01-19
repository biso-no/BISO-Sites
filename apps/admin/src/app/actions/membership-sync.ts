"use server";

import type {
  MembershipProductSyncItem,
  MembershipProductSyncResult,
} from "@repo/connectors/24sevenoffice";
import {
  previewMembershipSync,
  syncMembershipsFrom24SO,
} from "@repo/connectors/24sevenoffice";

export async function previewSync(): Promise<MembershipProductSyncItem[]> {
  const result = await previewMembershipSync();
  return result;
}

export async function executeSync(): Promise<MembershipProductSyncResult> {
  const result = await syncMembershipsFrom24SO();
  return result;
}
