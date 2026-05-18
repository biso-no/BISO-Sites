import { getTranslations } from "next-intl/server";
import { getCurrentItPermissions } from "@/lib/it-permissions";
import {
  getAuthenticationMethodsSummary,
  getM365UserDetail,
  getUserGroups,
  getUserLicenseDetails,
  listItLookupOptions,
  listM365SubscribedSkus,
} from "../../../_actions/it-users";
import { PageHeader } from "../../../_components/page-header";
import { UserDetailClient } from "../_components/user-detail-client";

interface M365UserDetailPageProps {
  params: Promise<{ userId: string }>;
}

export default async function M365UserDetailPage({
  params,
}: M365UserDetailPageProps) {
  const t = await getTranslations("adminPortal.it.users");
  const { userId } = await params;
  const decodedUserId = decodeURIComponent(userId);

  const [user, lookups, permissions] = await Promise.all([
    getM365UserDetail(decodedUserId),
    listItLookupOptions(),
    getCurrentItPermissions(),
  ]);

  if (user.error || lookups.error || !(user.data && lookups.data)) {
    return (
      <div className="pb-12">
        <PageHeader description={t("description")} title={t("title")} />
        <div
          className="rounded-2xl p-5 text-sm"
          style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.20)",
            color: "#fca5a5",
          }}
        >
          {user.error ?? lookups.error ?? "Unable to load Microsoft 365 user"}
        </div>
      </div>
    );
  }

  const [groups, licenses, authMethods, skus] = await Promise.all([
    getUserGroups(user.data.id),
    getUserLicenseDetails(user.data.id),
    getAuthenticationMethodsSummary(user.data.id),
    listM365SubscribedSkus(),
  ]);

  return (
    <div className="pb-12">
      <PageHeader
        description={user.data.userPrincipalName}
        title={user.data.displayName}
      />
      <UserDetailClient
        authMethods={authMethods.data}
        groups={groups.data ?? []}
        labels={{
          advancedTodo: t("advancedTodo"),
          addAlias: t("addAlias"),
          aliasAdded: t("aliasAdded"),
          aliasAvailable: t("aliasAvailable"),
          aliasCheck: t("aliasCheck"),
          aliasRemoved: t("aliasRemoved"),
          aliasTakenByGroup: t("aliasTakenByGroup"),
          aliasTakenByUser: t("aliasTakenByUser"),
          aliasTransferred: t("aliasTransferred"),
          aliasUnavailable: t("aliasUnavailable"),
          aliases: t("aliases"),
          confirmRemoveAliasDesc: t("confirmRemoveAliasDesc"),
          confirmRemoveAliasTitle: t("confirmRemoveAliasTitle"),
          mailNicknameSynced: t("mailNicknameSynced"),
          primaryAddress: t("primaryAddress"),
          removeAlias: t("removeAlias"),
          replacementAliasLabel: t("replacementAliasLabel"),
          replacementAliasPlaceholder: t("replacementAliasPlaceholder"),
          transferAlias: t("transferAlias"),
          upnAvailable: t("upnAvailable"),
          upnChecking: t("upnChecking"),
          upnInvalid: t("upnInvalid"),
          upnUnavailable: t("upnUnavailable"),
          dangerZone: t("dangerZone"),
          department: t("fields.department"),
          disabledWarning: t("disabledWarning"),
          exchangeRequired: t("exchangeRequired"),
          groups: t("groups"),
          licenses: t("licenses"),
          manager: t("manager"),
          officeLocation: t("fields.officeLocation"),
          profile: t("profile"),
          profileSaved: t("profileSaved"),
          saveProfile: t("saveProfile"),
          security: t("security"),
          noManager: t("noManager"),
          assignManager: t("assignManager"),
          changeManager: t("changeManager"),
          removeManager: t("removeManager"),
          managerAssigned: t("managerAssigned"),
          managerRemoved: t("managerRemoved"),
          searchManagerPlaceholder: t("searchManagerPlaceholder"),
          confirmChangeManagerTitle: t("confirmChangeManagerTitle"),
          confirmChangeManagerDesc: t("confirmChangeManagerDesc"),
          confirmRemoveManagerTitle: t("confirmRemoveManagerTitle"),
          confirmRemoveManagerDesc: t("confirmRemoveManagerDesc"),
          addToGroup: t("addToGroup"),
          removeFromGroup: t("removeFromGroup"),
          groupAdded: t("groupAdded"),
          groupRemoved: t("groupRemoved"),
          searchGroupPlaceholder: t("searchGroupPlaceholder"),
          confirmAddToGroupTitle: t("confirmAddToGroupTitle"),
          confirmAddToGroupDesc: t("confirmAddToGroupDesc"),
          confirmRemoveFromGroupTitle: t("confirmRemoveFromGroupTitle"),
          confirmRemoveFromGroupDesc: t("confirmRemoveFromGroupDesc"),
          groupTypeM365: t("groupType.m365"),
          groupTypeSecurity: t("groupType.security"),
          groupTypeDistribution: t("groupType.distribution"),
          groupTypeTeams: t("groupType.teams"),
          groupTypeOther: t("groupType.other"),
          assignLicense: t("assignLicense"),
          removeLicense: t("removeLicense"),
          licenseAssigned: t("licenseAssigned"),
          licenseRemoved: t("licenseRemoved"),
          noAvailableLicenses: t("noAvailableLicenses"),
          confirmAssignLicenseTitle: t("confirmAssignLicenseTitle"),
          confirmAssignLicenseDesc: t("confirmAssignLicenseDesc"),
          confirmRemoveLicenseTitle: t("confirmRemoveLicenseTitle"),
          confirmRemoveLicenseDesc: t("confirmRemoveLicenseDesc"),
          resetMfa: t("resetMfa"),
          mfaReset: t("mfaReset"),
          noMfaMethods: t("noMfaMethods"),
          confirmResetMfaTitle: t("confirmResetMfaTitle"),
          confirmResetMfaDesc: t("confirmResetMfaDesc"),
          forcePasswordReset: t("forcePasswordReset"),
          resetPassword: t("resetPassword"),
          passwordForcedReset: t("passwordForcedReset"),
          passwordReset: t("passwordReset"),
          newTemporaryPassword: t("newTemporaryPassword"),
          confirmForcePasswordResetTitle: t("confirmForcePasswordResetTitle"),
          confirmForcePasswordResetDesc: t("confirmForcePasswordResetDesc"),
          confirmResetPasswordTitle: t("confirmResetPasswordTitle"),
          confirmResetPasswordDesc: t("confirmResetPasswordDesc"),
          revokeSessions: t("revokeSessions"),
          sessionsRevoked: t("sessionsRevoked"),
          confirmRevokeSessionsTitle: t("confirmRevokeSessionsTitle"),
          confirmRevokeSessionsDesc: t("confirmRevokeSessionsDesc"),
          confirmActionButton: t("confirmActionButton"),
          noneAssigned: t("noneAssigned"),
        }}
        licenses={licenses.data ?? []}
        options={lookups.data}
        permissions={permissions}
        subscribedSkus={skus.data ?? []}
        user={user.data}
      />
    </div>
  );
}
