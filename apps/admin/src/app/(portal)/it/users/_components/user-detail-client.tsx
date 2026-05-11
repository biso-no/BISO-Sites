"use client";

const SMTP_PREFIX_REGEX = /^smtp:/i;
const ALLOWED_UPN_DOMAIN = "biso.no";

import type {
  M365AliasConflictResult,
  M365AuthenticationMethodsSummary,
  M365Permission,
  M365SubscribedSku,
  M365UserDetail,
  M365UserGroup,
  M365UserLicenseDetail,
  M365UserListItem,
  M365UserProfileUpdateInput,
} from "@repo/shared/types/user-management";
import {
  AlertTriangle,
  AtSign,
  BadgeCheck,
  Building2,
  KeyRound,
  Layers,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addM365UserAlias,
  addM365UserToGroup,
  assignM365License,
  checkAliasConflict,
  checkUpnAvailability,
  forcePasswordResetNextSignIn,
  removeM365License,
  removeM365UserAlias,
  removeM365UserFromGroup,
  removeM365UserManager,
  resetM365Mfa,
  resetM365Password,
  revokeM365SignInSessions,
  searchM365Groups,
  searchM365Users,
  transferM365Alias,
  updateM365UserManager,
  updateM365UserProfile,
} from "../../../_actions/it-users";
import {
  PortalField,
  PortalInput,
  PortalSelect,
} from "../../../_components/portal-fields";

type ItPermissionMap = Record<M365Permission, boolean>;

interface UserDetailClientProps {
  authMethods: M365AuthenticationMethodsSummary;
  groups: M365UserGroup[];
  labels: {
    addAlias: string;
    addToGroup: string;
    advancedTodo: string;
    aliasAdded: string;
    aliasAvailable: string;
    aliasCheck: string;
    aliasRemoved: string;
    aliasTakenByGroup: string;
    aliasTakenByUser: string;
    aliasTransferred: string;
    aliasUnavailable: string;
    aliases: string;
    assignLicense: string;
    assignManager: string;
    changeManager: string;
    confirmActionButton: string;
    confirmAddToGroupDesc: string;
    confirmAddToGroupTitle: string;
    confirmAssignLicenseDesc: string;
    confirmAssignLicenseTitle: string;
    confirmChangeManagerDesc: string;
    confirmChangeManagerTitle: string;
    confirmForcePasswordResetDesc: string;
    confirmForcePasswordResetTitle: string;
    confirmRemoveAliasDesc: string;
    confirmRemoveAliasTitle: string;
    confirmRemoveFromGroupDesc: string;
    confirmRemoveFromGroupTitle: string;
    confirmRemoveLicenseDesc: string;
    confirmRemoveLicenseTitle: string;
    confirmRemoveManagerDesc: string;
    confirmRemoveManagerTitle: string;
    confirmResetMfaDesc: string;
    confirmResetMfaTitle: string;
    confirmResetPasswordDesc: string;
    confirmResetPasswordTitle: string;
    confirmRevokeSessionsDesc: string;
    confirmRevokeSessionsTitle: string;
    dangerZone: string;
    department: string;
    disabledWarning: string;
    exchangeRequired: string;
    forcePasswordReset: string;
    groupAdded: string;
    groupRemoved: string;
    groupTypeDistribution: string;
    groupTypeM365: string;
    groupTypeOther: string;
    groupTypeSecurity: string;
    groupTypeTeams: string;
    groups: string;
    licenseAssigned: string;
    licenseRemoved: string;
    licenses: string;
    mailNicknameSynced: string;
    manager: string;
    managerAssigned: string;
    managerRemoved: string;
    mfaReset: string;
    newTemporaryPassword: string;
    noAvailableLicenses: string;
    noManager: string;
    noMfaMethods: string;
    noneAssigned: string;
    officeLocation: string;
    passwordForcedReset: string;
    passwordReset: string;
    primaryAddress: string;
    profile: string;
    profileSaved: string;
    removeAlias: string;
    removeFromGroup: string;
    removeLicense: string;
    removeManager: string;
    replacementAliasLabel: string;
    replacementAliasPlaceholder: string;
    resetMfa: string;
    resetPassword: string;
    revokeSessions: string;
    saveProfile: string;
    searchGroupPlaceholder: string;
    searchManagerPlaceholder: string;
    security: string;
    sessionsRevoked: string;
    transferAlias: string;
    upnAvailable: string;
    upnChecking: string;
    upnInvalid: string;
    upnUnavailable: string;
  };
  licenses: M365UserLicenseDetail[];
  options: {
    campuses: Array<{ id: string; name: string; officeLocation: string }>;
    departments: Array<{ campusId: string; id: string; name: string }>;
  };
  permissions: ItPermissionMap;
  subscribedSkus: M365SubscribedSku[];
  user: M365UserDetail;
}

type ConfirmConfig = {
  description: string;
  danger?: boolean;
  onConfirm: () => void;
  title: string;
} | null;

function Section({
  title,
  icon,
  children,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section
      className="rounded-2xl p-5"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="mb-4 flex items-center gap-2">
        <span style={{ color: "#3DA9E0" }}>{icon}</span>
        <h2 className="font-medium text-sm text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyInline({ text }: { text: string }) {
  return <p className="text-sm text-white/35">{text}</p>;
}

function PortalConfirm({
  config,
  onClose,
  actionLabel,
  isPending,
}: {
  actionLabel: string;
  config: ConfirmConfig;
  isPending: boolean;
  onClose: () => void;
}) {
  if (!config) {
    return null;
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{
          background: "rgba(8,18,38,0.98)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="font-medium text-sm text-white">{config.title}</h3>
          <button
            aria-label="Close"
            className="shrink-0 rounded-lg p-1 text-white/40 transition-colors hover:text-white/70"
            onClick={onClose}
            style={{ background: "rgba(255,255,255,0.05)" }}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
        <p className="mb-5 text-sm text-white/55">{config.description}</p>
        <div className="flex justify-end gap-2">
          <button
            className="rounded-xl px-4 py-2 text-sm disabled:opacity-50"
            disabled={isPending}
            onClick={onClose}
            style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-xl px-4 py-2 font-medium text-sm disabled:opacity-50"
            disabled={isPending}
            onClick={() => {
              config.onConfirm();
              onClose();
            }}
            style={{
              background: config.danger ? "rgba(239,68,68,0.85)" : "#3DA9E0",
              color: config.danger ? "#fff" : "#001731",
            }}
            type="button"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function getGroupTypeBadge(
  group: M365UserGroup,
  labels: {
    groupTypeDistribution: string;
    groupTypeM365: string;
    groupTypeOther: string;
    groupTypeSecurity: string;
    groupTypeTeams: string;
  }
): string {
  if (group.isTeamsRelated) {
    return labels.groupTypeTeams;
  }
  if (group.groupTypes.includes("Unified")) {
    return labels.groupTypeM365;
  }
  if (group.securityEnabled && !group.mailEnabled) {
    return labels.groupTypeSecurity;
  }
  if (group.mailEnabled && !group.securityEnabled) {
    return labels.groupTypeDistribution;
  }
  return labels.groupTypeOther;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Phase 2 IT sections intentionally colocated for reviewable implementation.
export function UserDetailClient({
  user,
  groups,
  licenses,
  authMethods,
  options,
  permissions,
  subscribedSkus,
  labels,
}: UserDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // UPN debounce state
  const [upnValue, setUpnValue] = useState(user.userPrincipalName);
  const [mailNicknameValue, setMailNicknameValue] = useState(
    user.mailNickname ?? ""
  );
  const [upnCheckState, setUpnCheckState] = useState<
    "idle" | "checking" | "available" | "unavailable" | "invalid"
  >("idle");
  const [upnConflictOwner, setUpnConflictOwner] = useState<{
    displayName?: string | null;
    upn?: string | null;
  } | null>(null);
  const upnDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mailNicknameManualRef = useRef(false);

  // Alias CRUD state
  const [addAliasValue, setAddAliasValue] = useState("");
  const [addAliasCheckState, setAddAliasCheckState] = useState<
    "idle" | "checking" | "available" | "taken_user" | "taken_group" | "error"
  >("idle");
  const [addAliasConflict, setAddAliasConflict] =
    useState<M365AliasConflictResult | null>(null);
  const [showTransferPanel, setShowTransferPanel] = useState(false);
  const [replacementAliasValue, setReplacementAliasValue] = useState("");
  const [replacementCheckState, setReplacementCheckState] = useState<
    "idle" | "checking" | "available" | "unavailable"
  >("idle");
  const aliasDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replacementDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [accountStatusConfirmation, setAccountStatusConfirmation] =
    useState("");
  const [accountEnabled, setAccountEnabled] = useState(
    user.accountEnabled !== false
  );

  // Phase 2 confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmConfig>(null);

  // Manager search state
  const [showManagerSearch, setShowManagerSearch] = useState(false);
  const [managerSearch, setManagerSearch] = useState("");
  const [managerResults, setManagerResults] = useState<M365UserListItem[]>([]);

  // Group search state
  const [showGroupSearch, setShowGroupSearch] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupResults, setGroupResults] = useState<M365UserGroup[]>([]);

  // License assign state
  const [showLicenseAssign, setShowLicenseAssign] = useState(false);

  // Temp password display
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const departmentOptions = options.departments.map((department) => ({
    label: department.name,
    value: department.name,
  }));
  const campusOptions = options.campuses.map((campus) => ({
    label: campus.name,
    value: campus.officeLocation,
  }));
  const currentAccountEnabled = user.accountEnabled !== false;
  const accountStatusChanged = accountEnabled !== currentAccountEnabled;
  const accountStatusConfirmationText = accountEnabled ? "ENABLE" : "DISABLE";
  const accountStatusConfirmationValid =
    !accountStatusChanged ||
    accountStatusConfirmation === accountStatusConfirmationText;

  const upnSaveBlocked =
    upnValue !== user.userPrincipalName &&
    (upnCheckState === "checking" ||
      upnCheckState === "unavailable" ||
      upnCheckState === "invalid");

  function getUpnStatusColor(): string {
    if (upnCheckState === "available") {
      return "#86efac";
    }
    if (upnCheckState === "checking") {
      return "rgba(255,255,255,0.35)";
    }
    return "#fca5a5";
  }

  function getUpnStatusText(): string {
    if (upnCheckState === "checking") {
      return labels.upnChecking;
    }
    if (upnCheckState === "available") {
      return labels.upnAvailable;
    }
    if (upnCheckState === "unavailable") {
      const suffix = upnConflictOwner?.displayName
        ? ` — ${upnConflictOwner.displayName}`
        : "";
      return `${labels.upnUnavailable}${suffix}`;
    }
    return labels.upnInvalid;
  }

  const assignedSkuIds = new Set(licenses.map((l) => l.skuId));
  const availableSkus = subscribedSkus.filter(
    (sku) =>
      !assignedSkuIds.has(sku.skuId) &&
      sku.prepaidUnits.enabled > sku.consumedUnits
  );

  const removableMfaMethods = authMethods.methods.filter(
    (m) => m.odataType !== "#microsoft.graph.passwordAuthenticationMethod"
  );

  function buildProfilePayload(formData: FormData): M365UserProfileUpdateInput {
    return {
      userId: user.id,
      accountStatusConfirmation: accountStatusChanged
        ? accountStatusConfirmation
        : undefined,
      accountEnabled,
      businessPhones: [String(formData.get("businessPhone") ?? "")].filter(
        Boolean
      ),
      department: String(formData.get("department") ?? "") || null,
      displayName: String(formData.get("displayName") ?? ""),
      givenName: String(formData.get("givenName") ?? "") || null,
      jobTitle: String(formData.get("jobTitle") ?? "") || null,
      mailNickname: mailNicknameValue,
      mobilePhone: String(formData.get("mobilePhone") ?? "") || null,
      officeLocation: String(formData.get("officeLocation") ?? "") || null,
      surname: String(formData.get("surname") ?? "") || null,
      userPrincipalName: upnValue,
    };
  }

  function handleProfileSubmit(formData: FormData) {
    if (!accountStatusConfirmationValid) {
      toast.error(labels.disabledWarning);
      return;
    }
    const payload = buildProfilePayload(formData);
    startTransition(async () => {
      const result = await updateM365UserProfile(payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(labels.profileSaved);
      router.refresh();
    });
  }

  function handleUpnChange(value: string) {
    setUpnValue(value);
    setUpnConflictOwner(null);

    if (!mailNicknameManualRef.current) {
      const prefix = value.split("@")[0] ?? "";
      if (prefix) {
        setMailNicknameValue(prefix);
      }
    }

    if (upnDebounceRef.current) {
      clearTimeout(upnDebounceRef.current);
    }
    if (!value || value === user.userPrincipalName) {
      setUpnCheckState("idle");
      return;
    }
    setUpnCheckState("checking");
    upnDebounceRef.current = setTimeout(() => {
      // Client-side gate: only call server when value looks like a complete email
      const lower = value.trim().toLowerCase();
      const atIndex = lower.indexOf("@");
      const isCompleteEmail =
        atIndex > 0 && lower.lastIndexOf(".") > atIndex + 1;
      if (!isCompleteEmail) {
        // Still typing — stay silent
        setUpnCheckState("idle");
        return;
      }
      if (!lower.endsWith(`@${ALLOWED_UPN_DOMAIN}`)) {
        setUpnCheckState("invalid");
        return;
      }
      startTransition(async () => {
        const result = await checkUpnAvailability({
          userId: user.id,
          upn: value,
        });
        if (result.error) {
          setUpnCheckState("invalid");
          return;
        }
        if (result.data?.available) {
          setUpnCheckState("available");
        } else {
          setUpnCheckState("unavailable");
          setUpnConflictOwner(result.data?.owner ?? null);
        }
      });
    }, 400);
  }

  function handleMailNicknameChange(value: string) {
    mailNicknameManualRef.current = true;
    setMailNicknameValue(value);
  }

  function handleAddAliasChange(value: string) {
    setAddAliasValue(value);
    setAddAliasConflict(null);
    setShowTransferPanel(false);
    setReplacementAliasValue("");
    setReplacementCheckState("idle");

    if (aliasDebounceRef.current) {
      clearTimeout(aliasDebounceRef.current);
    }
    if (!value) {
      setAddAliasCheckState("idle");
      return;
    }
    setAddAliasCheckState("checking");
    aliasDebounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const result = await checkAliasConflict({
          alias: value,
          targetUserId: user.id,
        });
        if (result.error || !result.data) {
          setAddAliasCheckState("error");
          return;
        }
        if (result.data.available) {
          setAddAliasCheckState("available");
        } else if (result.data.owner?.type === "group") {
          setAddAliasCheckState("taken_group");
          setAddAliasConflict(result.data);
        } else {
          setAddAliasCheckState("taken_user");
          setAddAliasConflict(result.data);
        }
      });
    }, 400);
  }

  function handleAddAlias() {
    startTransition(async () => {
      const result = await addM365UserAlias({
        userId: user.id,
        alias: addAliasValue,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(labels.aliasAdded);
      setAddAliasValue("");
      setAddAliasCheckState("idle");
      setAddAliasConflict(null);
      router.refresh();
    });
  }

  function handleRemoveAlias(address: string) {
    const displayAddress = address.replace(SMTP_PREFIX_REGEX, "");
    setConfirmDialog({
      title: labels.confirmRemoveAliasTitle,
      description: `${labels.confirmRemoveAliasDesc} "${displayAddress}"`,
      danger: true,
      onConfirm: () => {
        startTransition(async () => {
          const result = await removeM365UserAlias({
            userId: user.id,
            alias: address,
          });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(labels.aliasRemoved);
          router.refresh();
        });
      },
    });
  }

  function handleReplacementAliasChange(value: string) {
    setReplacementAliasValue(value);
    if (replacementDebounceRef.current) {
      clearTimeout(replacementDebounceRef.current);
    }
    if (!value) {
      setReplacementCheckState("idle");
      return;
    }
    setReplacementCheckState("checking");
    replacementDebounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const result = await checkAliasConflict({
          alias: value,
          targetUserId: user.id,
        });
        if (result.error || !result.data) {
          setReplacementCheckState("unavailable");
          return;
        }
        setReplacementCheckState(
          result.data.available ? "available" : "unavailable"
        );
      });
    }, 400);
  }

  function handleTransferAlias() {
    if (!addAliasConflict?.owner) {
      return;
    }
    const ownerId = addAliasConflict.owner.id;
    startTransition(async () => {
      const result = await transferM365Alias({
        fromUserId: ownerId,
        toUserId: user.id,
        alias: addAliasValue,
        replacementAlias: replacementAliasValue || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(labels.aliasTransferred);
      setAddAliasValue("");
      setAddAliasCheckState("idle");
      setAddAliasConflict(null);
      setShowTransferPanel(false);
      setReplacementAliasValue("");
      setReplacementCheckState("idle");
      router.refresh();
    });
  }

  function handleManagerSearch(query: string) {
    setManagerSearch(query);
    if (!query.trim()) {
      setManagerResults([]);
      return;
    }
    startTransition(async () => {
      const result = await searchM365Users({ query, limit: 8 });
      if (result.data) {
        setManagerResults(result.data.filter((u) => u.id !== user.id));
      }
    });
  }

  function handleSelectManager(candidate: M365UserListItem) {
    setConfirmDialog({
      title: labels.confirmChangeManagerTitle,
      description: `${labels.confirmChangeManagerDesc} → ${candidate.displayName} (${candidate.userPrincipalName})`,
      onConfirm: () => {
        startTransition(async () => {
          const result = await updateM365UserManager({
            userId: user.id,
            managerId: candidate.id,
          });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(labels.managerAssigned);
          setShowManagerSearch(false);
          setManagerSearch("");
          setManagerResults([]);
          router.refresh();
        });
      },
    });
  }

  function handleRemoveManager() {
    setConfirmDialog({
      title: labels.confirmRemoveManagerTitle,
      description: labels.confirmRemoveManagerDesc,
      danger: true,
      onConfirm: () => {
        startTransition(async () => {
          const result = await removeM365UserManager({ userId: user.id });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(labels.managerRemoved);
          router.refresh();
        });
      },
    });
  }

  function handleGroupSearch(query: string) {
    setGroupSearch(query);
    if (!query.trim()) {
      setGroupResults([]);
      return;
    }
    startTransition(async () => {
      const result = await searchM365Groups({ query, limit: 8 });
      if (result.data) {
        const currentIds = new Set(groups.map((g) => g.id));
        setGroupResults(result.data.filter((g) => !currentIds.has(g.id)));
      }
    });
  }

  function handleAddToGroup(group: M365UserGroup) {
    setConfirmDialog({
      title: labels.confirmAddToGroupTitle,
      description: `${labels.confirmAddToGroupDesc} — ${group.displayName}`,
      onConfirm: () => {
        startTransition(async () => {
          const result = await addM365UserToGroup({
            userId: user.id,
            groupId: group.id,
          });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(labels.groupAdded);
          setShowGroupSearch(false);
          setGroupSearch("");
          setGroupResults([]);
          router.refresh();
        });
      },
    });
  }

  function handleRemoveFromGroup(group: M365UserGroup) {
    setConfirmDialog({
      title: labels.confirmRemoveFromGroupTitle,
      description: `${labels.confirmRemoveFromGroupDesc} — ${group.displayName}`,
      danger: true,
      onConfirm: () => {
        startTransition(async () => {
          const result = await removeM365UserFromGroup({
            userId: user.id,
            groupId: group.id,
          });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(labels.groupRemoved);
          router.refresh();
        });
      },
    });
  }

  function handleAssignLicense(sku: M365SubscribedSku) {
    setConfirmDialog({
      title: labels.confirmAssignLicenseTitle,
      description: `${labels.confirmAssignLicenseDesc} — ${sku.skuPartNumber}`,
      onConfirm: () => {
        startTransition(async () => {
          const result = await assignM365License({
            userId: user.id,
            skuId: sku.skuId,
          });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(labels.licenseAssigned);
          setShowLicenseAssign(false);
          router.refresh();
        });
      },
    });
  }

  function handleRemoveLicense(license: M365UserLicenseDetail) {
    setConfirmDialog({
      title: labels.confirmRemoveLicenseTitle,
      description: `${labels.confirmRemoveLicenseDesc} — ${license.skuPartNumber ?? license.skuId}`,
      danger: true,
      onConfirm: () => {
        startTransition(async () => {
          const result = await removeM365License({
            userId: user.id,
            skuId: license.skuId,
          });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(labels.licenseRemoved);
          router.refresh();
        });
      },
    });
  }

  function handleResetMfa() {
    setConfirmDialog({
      title: labels.confirmResetMfaTitle,
      description: labels.confirmResetMfaDesc,
      danger: true,
      onConfirm: () => {
        startTransition(async () => {
          const result = await resetM365Mfa({ userId: user.id });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(labels.mfaReset);
          router.refresh();
        });
      },
    });
  }

  function handleForcePasswordReset() {
    setConfirmDialog({
      title: labels.confirmForcePasswordResetTitle,
      description: labels.confirmForcePasswordResetDesc,
      danger: true,
      onConfirm: () => {
        startTransition(async () => {
          const result = await forcePasswordResetNextSignIn({
            userId: user.id,
          });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(labels.passwordForcedReset);
        });
      },
    });
  }

  function handleResetPassword() {
    setConfirmDialog({
      title: labels.confirmResetPasswordTitle,
      description: labels.confirmResetPasswordDesc,
      danger: true,
      onConfirm: () => {
        startTransition(async () => {
          const result = await resetM365Password({ userId: user.id });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          setTempPassword(result.data?.temporaryPassword ?? "");
          toast.success(labels.passwordReset);
        });
      },
    });
  }

  function handleRevokeSessions() {
    setConfirmDialog({
      title: labels.confirmRevokeSessionsTitle,
      description: labels.confirmRevokeSessionsDesc,
      danger: true,
      onConfirm: () => {
        startTransition(async () => {
          const result = await revokeM365SignInSessions({ userId: user.id });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(labels.sessionsRevoked);
        });
      },
    });
  }

  return (
    <>
      <PortalConfirm
        actionLabel={labels.confirmActionButton}
        config={confirmDialog}
        isPending={isPending}
        onClose={() => setConfirmDialog(null)}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          {/* Profile */}
          <Section icon={<BadgeCheck size={16} />} title={labels.profile}>
            <form
              action={handleProfileSubmit}
              className="grid gap-4 md:grid-cols-2"
            >
              <PortalField label="Display name" required>
                <PortalInput
                  defaultValue={user.displayName}
                  disabled={!permissions["it.users.editProfile"]}
                  name="displayName"
                  required
                />
              </PortalField>
              <div>
                <PortalField label="User principal name" required>
                  <PortalInput
                    disabled={!permissions["it.users.editProfile"]}
                    name="userPrincipalName"
                    onChange={(e) => handleUpnChange(e.currentTarget.value)}
                    required
                    type="email"
                    value={upnValue}
                  />
                </PortalField>
                {upnCheckState !== "idle" &&
                  permissions["it.users.editProfile"] && (
                    <p
                      className="mt-1 text-xs"
                      style={{ color: getUpnStatusColor() }}
                    >
                      {getUpnStatusText()}
                    </p>
                  )}
              </div>
              <PortalField label="Given name">
                <PortalInput
                  defaultValue={user.givenName ?? ""}
                  disabled={!permissions["it.users.editProfile"]}
                  name="givenName"
                />
              </PortalField>
              <PortalField label="Surname">
                <PortalInput
                  defaultValue={user.surname ?? ""}
                  disabled={!permissions["it.users.editProfile"]}
                  name="surname"
                />
              </PortalField>
              <div>
                <PortalField label="Mail nickname" required>
                  <PortalInput
                    disabled={!permissions["it.users.editProfile"]}
                    name="mailNickname"
                    onChange={(e) =>
                      handleMailNicknameChange(e.currentTarget.value)
                    }
                    required
                    value={mailNicknameValue}
                  />
                </PortalField>
                {!mailNicknameManualRef.current &&
                  upnValue !== user.userPrincipalName && (
                    <p
                      className="mt-1 text-xs"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                    >
                      {labels.mailNicknameSynced}
                    </p>
                  )}
              </div>
              <PortalField label="Job title">
                <PortalInput
                  defaultValue={user.jobTitle ?? ""}
                  disabled={!permissions["it.users.editProfile"]}
                  name="jobTitle"
                />
              </PortalField>
              <PortalField label={labels.department}>
                <PortalSelect
                  defaultValue={user.department ?? ""}
                  disabled={!permissions["it.users.editProfile"]}
                  name="department"
                  options={departmentOptions}
                  placeholder="Select department"
                />
              </PortalField>
              <PortalField label={labels.officeLocation}>
                <PortalSelect
                  defaultValue={user.officeLocation ?? ""}
                  disabled={!permissions["it.users.editProfile"]}
                  name="officeLocation"
                  options={campusOptions}
                  placeholder="Select office"
                />
              </PortalField>
              <PortalField label="Mobile phone">
                <PortalInput
                  defaultValue={user.mobilePhone ?? ""}
                  disabled={!permissions["it.users.editProfile"]}
                  name="mobilePhone"
                />
              </PortalField>
              <PortalField label="Business phone">
                <PortalInput
                  defaultValue={user.businessPhones[0] ?? ""}
                  disabled={!permissions["it.users.editProfile"]}
                  name="businessPhone"
                />
              </PortalField>
              <PortalField label="Account status">
                <PortalSelect
                  disabled={!permissions["it.users.disable"]}
                  name="accountEnabled"
                  onChange={(event) =>
                    setAccountEnabled(event.currentTarget.value === "true")
                  }
                  options={[
                    { label: "Enabled", value: "true" },
                    { label: "Disabled", value: "false" },
                  ]}
                  value={accountEnabled ? "true" : "false"}
                />
              </PortalField>

              {accountStatusChanged && (
                <div className="md:col-span-2">
                  <PortalField
                    hint={labels.disabledWarning}
                    label={labels.dangerZone}
                    required
                  >
                    <PortalInput
                      onChange={(event) =>
                        setAccountStatusConfirmation(event.currentTarget.value)
                      }
                      placeholder={accountStatusConfirmationText}
                      value={accountStatusConfirmation}
                    />
                  </PortalField>
                </div>
              )}

              <div className="md:col-span-2">
                <button
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm transition-all disabled:opacity-50"
                  disabled={
                    isPending ||
                    !permissions["it.users.editProfile"] ||
                    upnSaveBlocked
                  }
                  style={{
                    background: "#3DA9E0",
                    color: "#001731",
                    boxShadow: "0 0 20px rgba(61,169,224,0.25)",
                  }}
                  type="submit"
                >
                  {labels.saveProfile}
                </button>
              </div>
            </form>
          </Section>

          {/* Aliases */}
          <Section icon={<AtSign size={16} />} title={labels.aliases}>
            {/* Existing proxy addresses list */}
            <div className="mb-4 space-y-1.5">
              {user.proxyAddresses.length > 0 ? (
                user.proxyAddresses
                  .slice()
                  .sort((a, b) => {
                    if (a.startsWith("SMTP:")) {
                      return -1;
                    }
                    if (b.startsWith("SMTP:")) {
                      return 1;
                    }
                    return 0;
                  })
                  .map((address) => {
                    const isPrimary = address.startsWith("SMTP:");
                    const displayAddress = address.replace(
                      SMTP_PREFIX_REGEX,
                      ""
                    );
                    return (
                      <div
                        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
                        key={address}
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="truncate font-mono text-xs"
                            style={{
                              color: isPrimary
                                ? "#3DA9E0"
                                : "rgba(255,255,255,0.70)",
                            }}
                          >
                            {displayAddress}
                          </span>
                          {isPrimary && (
                            <span
                              className="shrink-0 rounded-full px-1.5 py-0.5 text-xs"
                              style={{
                                background: "rgba(61,169,224,0.14)",
                                color: "#3DA9E0",
                              }}
                            >
                              {labels.primaryAddress}
                            </span>
                          )}
                        </div>
                        {!isPrimary &&
                          permissions["it.users.manageAliases"] && (
                            <button
                              className="shrink-0 rounded-lg px-2.5 py-1 text-xs disabled:opacity-40"
                              disabled={isPending}
                              onClick={() => handleRemoveAlias(address)}
                              style={{
                                background: "rgba(248,113,113,0.12)",
                                color: "#fca5a5",
                              }}
                              type="button"
                            >
                              {labels.removeAlias}
                            </button>
                          )}
                      </div>
                    );
                  })
              ) : (
                <EmptyInline text="No aliases returned by Microsoft Graph." />
              )}
            </div>

            {/* Add alias */}
            {permissions["it.users.manageAliases"] && (
              <div className="space-y-2">
                <PortalInput
                  onChange={(event) =>
                    handleAddAliasChange(event.currentTarget.value)
                  }
                  placeholder={`alias@${ALLOWED_UPN_DOMAIN}`}
                  type="email"
                  value={addAliasValue}
                />

                {addAliasCheckState === "checking" && (
                  <p
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    {labels.upnChecking}
                  </p>
                )}

                {addAliasCheckState === "available" && (
                  <div className="flex items-center gap-3">
                    <p className="text-xs" style={{ color: "#86efac" }}>
                      {labels.aliasAvailable}
                    </p>
                    <button
                      className="rounded-xl px-3 py-1.5 text-sm disabled:opacity-50"
                      disabled={isPending}
                      onClick={handleAddAlias}
                      style={{ background: "#3DA9E0", color: "#001731" }}
                      type="button"
                    >
                      {labels.addAlias}
                    </button>
                  </div>
                )}

                {addAliasCheckState === "taken_group" && (
                  <p className="text-xs" style={{ color: "#fca5a5" }}>
                    {labels.aliasTakenByGroup}
                  </p>
                )}

                {addAliasCheckState === "taken_user" &&
                  addAliasConflict?.owner && (
                    <div
                      className="space-y-3 rounded-xl p-3"
                      style={{
                        background: "rgba(248,113,113,0.08)",
                        border: "1px solid rgba(248,113,113,0.20)",
                      }}
                    >
                      <div>
                        <p className="text-sm" style={{ color: "#fca5a5" }}>
                          {labels.aliasTakenByUser}
                        </p>
                        <p className="mt-0.5 text-white/45 text-xs">
                          {addAliasConflict.owner.displayName ?? ""}
                          {addAliasConflict.owner.userPrincipalName
                            ? ` (${addAliasConflict.owner.userPrincipalName})`
                            : ""}
                        </p>
                      </div>

                      {permissions["it.users.transferAlias"] && (
                        <div>
                          {showTransferPanel ? (
                            <div className="space-y-2">
                              <p
                                className="text-xs"
                                style={{ color: "rgba(255,255,255,0.45)" }}
                              >
                                {labels.replacementAliasLabel}
                              </p>
                              <PortalInput
                                onChange={(e) =>
                                  handleReplacementAliasChange(
                                    e.currentTarget.value
                                  )
                                }
                                placeholder={labels.replacementAliasPlaceholder}
                                type="email"
                                value={replacementAliasValue}
                              />
                              {replacementCheckState === "checking" && (
                                <p
                                  className="text-xs"
                                  style={{ color: "rgba(255,255,255,0.35)" }}
                                >
                                  {labels.upnChecking}
                                </p>
                              )}
                              {replacementCheckState === "available" && (
                                <p
                                  className="text-xs"
                                  style={{ color: "#86efac" }}
                                >
                                  {labels.upnAvailable}
                                </p>
                              )}
                              {replacementCheckState === "unavailable" && (
                                <p
                                  className="text-xs"
                                  style={{ color: "#fca5a5" }}
                                >
                                  {labels.upnUnavailable}
                                </p>
                              )}
                              <div className="flex gap-2">
                                <button
                                  className="rounded-xl px-3 py-1.5 text-sm disabled:opacity-50"
                                  disabled={
                                    isPending ||
                                    replacementCheckState === "checking" ||
                                    replacementCheckState === "unavailable"
                                  }
                                  onClick={handleTransferAlias}
                                  style={{
                                    background: "rgba(239,68,68,0.80)",
                                    color: "#fff",
                                  }}
                                  type="button"
                                >
                                  {labels.transferAlias}
                                </button>
                                <button
                                  className="text-white/35 text-xs"
                                  onClick={() => {
                                    setShowTransferPanel(false);
                                    setReplacementAliasValue("");
                                    setReplacementCheckState("idle");
                                  }}
                                  type="button"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="rounded-xl px-3 py-1.5 text-sm disabled:opacity-50"
                              disabled={isPending}
                              onClick={() => setShowTransferPanel(true)}
                              style={{
                                background: "rgba(248,113,113,0.20)",
                                color: "#fca5a5",
                              }}
                              type="button"
                            >
                              {labels.transferAlias}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            )}
          </Section>

          {/* Groups */}
          <Section icon={<Users size={16} />} title={labels.groups}>
            {groups.length === 0 ? (
              <EmptyInline text="No direct groups." />
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <div
                    className="flex items-start justify-between gap-2 rounded-xl px-3 py-2"
                    key={group.id}
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">
                        {group.displayName}
                      </p>
                      <p className="mt-0.5 text-white/35 text-xs">
                        {getGroupTypeBadge(group, labels)}
                      </p>
                    </div>
                    {permissions["it.users.manageGroups"] && (
                      <button
                        className="shrink-0 rounded-lg px-2.5 py-1 text-xs disabled:opacity-40"
                        disabled={isPending}
                        onClick={() => handleRemoveFromGroup(group)}
                        style={{
                          background: "rgba(248,113,113,0.12)",
                          color: "#fca5a5",
                        }}
                        type="button"
                      >
                        {labels.removeFromGroup}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {permissions["it.users.manageGroups"] && (
              <div className="mt-3">
                {showGroupSearch ? (
                  <div className="space-y-2">
                    <PortalInput
                      onChange={(e) => handleGroupSearch(e.currentTarget.value)}
                      placeholder={labels.searchGroupPlaceholder}
                      value={groupSearch}
                    />
                    {groupResults.length > 0 && (
                      <div
                        className="rounded-xl"
                        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        {groupResults.map((g) => (
                          <button
                            className="flex w-full flex-col gap-0.5 px-3 py-2 text-left first:rounded-t-xl last:rounded-b-xl"
                            key={g.id}
                            onClick={() => handleAddToGroup(g)}
                            style={{
                              background: "rgba(255,255,255,0.03)",
                            }}
                            type="button"
                          >
                            <span className="text-sm text-white">
                              {g.displayName}
                            </span>
                            <span className="text-white/35 text-xs">
                              {getGroupTypeBadge(g, labels)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      className="text-white/35 text-xs"
                      onClick={() => {
                        setShowGroupSearch(false);
                        setGroupSearch("");
                        setGroupResults([]);
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="rounded-xl px-3 py-1.5 text-sm disabled:opacity-50"
                    disabled={isPending}
                    onClick={() => setShowGroupSearch(true)}
                    style={{
                      background: "rgba(61,169,224,0.10)",
                      color: "#3DA9E0",
                    }}
                    type="button"
                  >
                    {labels.addToGroup}
                  </button>
                )}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          {/* Manager */}
          <Section icon={<Building2 size={16} />} title={labels.manager}>
            {user.manager ? (
              <div className="mb-3">
                <p className="text-sm text-white">{user.manager.displayName}</p>
                <p className="mt-1 text-white/35 text-xs">
                  {user.manager.userPrincipalName}
                </p>
              </div>
            ) : (
              <p className="mb-3 text-sm text-white/35">{labels.noManager}</p>
            )}

            {permissions["it.users.manageManagers"] && (
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-xl px-3 py-1.5 text-sm disabled:opacity-50"
                  disabled={isPending}
                  onClick={() => setShowManagerSearch(true)}
                  style={{
                    background: "rgba(61,169,224,0.10)",
                    color: "#3DA9E0",
                  }}
                  type="button"
                >
                  {user.manager ? labels.changeManager : labels.assignManager}
                </button>
                {user.manager && (
                  <button
                    className="rounded-xl px-3 py-1.5 text-sm disabled:opacity-50"
                    disabled={isPending}
                    onClick={handleRemoveManager}
                    style={{
                      background: "rgba(248,113,113,0.10)",
                      color: "#fca5a5",
                    }}
                    type="button"
                  >
                    {labels.removeManager}
                  </button>
                )}
              </div>
            )}

            {showManagerSearch && (
              <div className="mt-3 space-y-2">
                <PortalInput
                  onChange={(e) => handleManagerSearch(e.currentTarget.value)}
                  placeholder={labels.searchManagerPlaceholder}
                  value={managerSearch}
                />
                {managerResults.length > 0 && (
                  <div
                    className="rounded-xl"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {managerResults.map((u) => (
                      <button
                        className="flex w-full flex-col gap-0.5 px-3 py-2 text-left first:rounded-t-xl last:rounded-b-xl"
                        key={u.id}
                        onClick={() => handleSelectManager(u)}
                        style={{ background: "rgba(255,255,255,0.03)" }}
                        type="button"
                      >
                        <span className="text-sm text-white">
                          {u.displayName}
                        </span>
                        <span className="text-white/35 text-xs">
                          {u.userPrincipalName}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className="text-white/35 text-xs"
                  onClick={() => {
                    setShowManagerSearch(false);
                    setManagerSearch("");
                    setManagerResults([]);
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            )}
          </Section>

          {/* Licenses */}
          <Section icon={<Layers size={16} />} title={labels.licenses}>
            {licenses.length === 0 ? (
              <p className="mb-3 text-sm text-white/35">
                {labels.noneAssigned}
              </p>
            ) : (
              <div className="mb-3 space-y-2">
                {licenses.map((license) => (
                  <div
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
                    key={license.skuId}
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-white text-xs">
                        {license.skuPartNumber ?? license.skuId}
                      </p>
                      <p className="mt-0.5 text-white/35 text-xs">
                        {license.servicePlans.length} service plans
                      </p>
                    </div>
                    {permissions["it.users.manageLicenses"] && (
                      <button
                        className="shrink-0 rounded-lg px-2.5 py-1 text-xs disabled:opacity-40"
                        disabled={isPending}
                        onClick={() => handleRemoveLicense(license)}
                        style={{
                          background: "rgba(248,113,113,0.12)",
                          color: "#fca5a5",
                        }}
                        type="button"
                      >
                        {labels.removeLicense}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {permissions["it.users.manageLicenses"] && (
              <div>
                {showLicenseAssign ? (
                  <div className="space-y-2">
                    {availableSkus.length === 0 ? (
                      <p className="text-sm text-white/35">
                        {labels.noAvailableLicenses}
                      </p>
                    ) : (
                      <div
                        className="rounded-xl"
                        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        {availableSkus.map((sku) => (
                          <button
                            className="flex w-full flex-col gap-0.5 px-3 py-2 text-left first:rounded-t-xl last:rounded-b-xl"
                            key={sku.skuId}
                            onClick={() => handleAssignLicense(sku)}
                            style={{ background: "rgba(255,255,255,0.03)" }}
                            type="button"
                          >
                            <span className="font-mono text-sm text-white">
                              {sku.skuPartNumber}
                            </span>
                            <span className="text-white/35 text-xs">
                              {sku.consumedUnits} / {sku.prepaidUnits.enabled}{" "}
                              used
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      className="text-white/35 text-xs"
                      onClick={() => setShowLicenseAssign(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="rounded-xl px-3 py-1.5 text-sm disabled:opacity-50"
                    disabled={isPending}
                    onClick={() => setShowLicenseAssign(true)}
                    style={{
                      background: "rgba(61,169,224,0.10)",
                      color: "#3DA9E0",
                    }}
                    type="button"
                  >
                    {labels.assignLicense}
                  </button>
                )}
              </div>
            )}
          </Section>

          {/* MFA / Security */}
          <Section icon={<KeyRound size={16} />} title={labels.security}>
            {authMethods.error && (
              <div
                className="mb-3 rounded-xl p-3 text-xs"
                style={{
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.20)",
                  color: "#fca5a5",
                }}
              >
                {authMethods.error}
              </div>
            )}
            {authMethods.methods.length === 0 ? (
              <EmptyInline text="No authentication methods returned." />
            ) : (
              <div className="mb-3 space-y-2">
                {authMethods.methods.map((method) => (
                  <div
                    className="rounded-xl px-3 py-2"
                    key={method.id}
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <p className="text-sm text-white">
                      {method.displayName ?? method.type}
                    </p>
                    <p className="mt-1 text-white/35 text-xs">{method.type}</p>
                  </div>
                ))}
              </div>
            )}

            {permissions["it.users.resetMfa"] &&
              removableMfaMethods.length > 0 && (
                <button
                  className="rounded-xl px-3 py-1.5 text-sm disabled:opacity-50"
                  disabled={isPending}
                  onClick={handleResetMfa}
                  style={{
                    background: "rgba(248,113,113,0.10)",
                    color: "#fca5a5",
                  }}
                  type="button"
                >
                  {labels.resetMfa}
                </button>
              )}

            {permissions["it.users.resetMfa"] &&
              removableMfaMethods.length === 0 &&
              !authMethods.error && (
                <p className="text-white/35 text-xs">{labels.noMfaMethods}</p>
              )}
          </Section>

          {/* Danger Zone */}
          <Section icon={<ShieldAlert size={16} />} title={labels.dangerZone}>
            <div className="space-y-3">
              {permissions["it.users.resetPassword"] && (
                <>
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p className="mb-2 text-sm text-white/70">
                      {labels.forcePasswordReset}
                    </p>
                    <button
                      className="rounded-xl px-3 py-1.5 text-sm disabled:opacity-50"
                      disabled={isPending}
                      onClick={handleForcePasswordReset}
                      style={{
                        background: "rgba(248,113,113,0.10)",
                        color: "#fca5a5",
                      }}
                      type="button"
                    >
                      {labels.forcePasswordReset}
                    </button>
                  </div>

                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p className="mb-2 text-sm text-white/70">
                      {labels.resetPassword}
                    </p>
                    <button
                      className="rounded-xl px-3 py-1.5 text-sm disabled:opacity-50"
                      disabled={isPending}
                      onClick={handleResetPassword}
                      style={{
                        background: "rgba(248,113,113,0.10)",
                        color: "#fca5a5",
                      }}
                      type="button"
                    >
                      {labels.resetPassword}
                    </button>
                    {tempPassword && (
                      <div className="mt-3">
                        <p className="mb-1 text-white/50 text-xs">
                          {labels.newTemporaryPassword}
                        </p>
                        <button
                          className="w-full rounded-xl px-3 py-2 text-left font-mono text-sm text-white"
                          onClick={() => {
                            navigator.clipboard
                              .writeText(tempPassword)
                              .then(() => toast.success("Copied"))
                              .catch(() => undefined);
                          }}
                          style={{ background: "rgba(61,169,224,0.10)" }}
                          type="button"
                        >
                          {tempPassword}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {permissions["it.users.revokeSessions"] && (
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="mb-2 flex gap-2 rounded-lg p-2 text-xs"
                    style={{
                      background: "rgba(250,204,21,0.08)",
                      color: "#fde68a",
                    }}
                  >
                    <AlertTriangle className="mt-0.5 shrink-0" size={12} />
                    <span>{labels.confirmRevokeSessionsDesc}</span>
                  </div>
                  <button
                    className="rounded-xl px-3 py-1.5 text-sm disabled:opacity-50"
                    disabled={isPending}
                    onClick={handleRevokeSessions}
                    style={{
                      background: "rgba(248,113,113,0.10)",
                      color: "#fca5a5",
                    }}
                    type="button"
                  >
                    {labels.revokeSessions}
                  </button>
                </div>
              )}

              {!(
                permissions["it.users.resetPassword"] ||
                permissions["it.users.revokeSessions"]
              ) && (
                <p className="text-sm text-white/50">
                  No risk controls available for your permission level.
                </p>
              )}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
