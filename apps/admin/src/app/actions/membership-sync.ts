"use server";

import {
    previewMembershipSync,
    syncMembershipsFrom24SO
} from "@repo/connectors/24sevenoffice";
import type { MembershipProductSyncItem, MembershipProductSyncResult } from "@repo/connectors/24sevenoffice";

export async function previewSync(): Promise<MembershipProductSyncItem[]> {
    return previewMembershipSync();
}

export async function executeSync(): Promise<MembershipProductSyncResult> {
    return syncMembershipsFrom24SO();
}
