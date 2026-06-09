"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Campus, Departments } from "@repo/api/types/appwrite";
import {
  type GraphUserService,
  generateTemporaryPassword,
  generateUpn,
} from "@repo/connectors/azure/users";
import {
  type M365AliasConflictResult,
  type M365CreateUserInput,
  type M365GroupMembershipInput,
  type M365LicenseManageInput,
  type M365ManagerUpdateInput,
  type M365Permission,
  type M365SubscribedSku,
  type M365UserDetail,
  type M365UserGroup,
  type M365UserLicenseDetail,
  type M365UserListItem,
  type M365UserProfileUpdateInput,
  m365AliasAddSchema,
  m365AliasConflictSchema,
  m365AliasRemoveSchema,
  m365AliasTransferSchema,
  m365CreateUserSchema,
  m365GroupMembershipSchema,
  m365GroupSearchSchema,
  m365LicenseManageSchema,
  m365ManagerUpdateSchema,
  m365UpnCheckSchema,
  m365UserIdSchema,
  m365UserProfileUpdateSchema,
  m365UserSearchSchema,
} from "@repo/shared/types/user-management";
import { revalidatePath } from "next/cache";
import { getGraphService, M365_DOMAIN, toListItem } from "@/lib/it/graph";
import { requireItPermission } from "@/lib/it-permissions";
import { logAuditEvent } from "./audit-log";

const LEADING_AT_REGEX = /^@/;
const GRAPH_DUPLICATE_USER_REGEX = /already exists|objectConflict/i;
const SMTP_PREFIX_REGEX = /^smtp:/i;

type ActionResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

interface ItLookupOptions {
  campuses: Array<{ id: string; name: string; officeLocation: string }>;
  departments: Array<{ campusId: string; id: string; name: string }>;
}

interface LookupValidationResult {
  campus?: { id: string; name: string; officeLocation: string };
  department?: { campusId: string; id: string; name: string };
  options: ItLookupOptions;
}

function getErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (GRAPH_DUPLICATE_USER_REGEX.test(message)) {
    return "A Microsoft 365 user with this UPN or mail nickname already exists.";
  }
  return message;
}

function toDetail(
  user: NonNullable<Awaited<ReturnType<GraphUserService["getUser"]>>>,
  manager: M365UserListItem | null
): M365UserDetail {
  return {
    ...toListItem(user),
    assignedLicenses: user.assignedLicenses ?? [],
    businessPhones: user.businessPhones ?? [],
    employeeId: user.employeeId ?? null,
    givenName: user.givenName ?? null,
    mailNickname: user.mailNickname ?? null,
    manager,
    mobilePhone: user.mobilePhone ?? null,
    proxyAddresses: user.proxyAddresses ?? [],
    surname: user.surname ?? null,
  };
}

function toNullableString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isAllowedTenantUser(user: {
  assignedLicenses?: Array<{ skuId: string }>;
  mail?: string;
  userPrincipalName: string;
}): boolean {
  const allowedDomain = `@${M365_DOMAIN.toLowerCase().replace(
    LEADING_AT_REGEX,
    ""
  )}`;
  const hasDomain = [user.userPrincipalName, user.mail]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().endsWith(allowedDomain));
  const hasLicense = (user.assignedLicenses?.length ?? 0) > 0;

  return hasDomain && hasLicense;
}

function isAllowedDomainValue(value: string): boolean {
  const allowedDomain = `@${M365_DOMAIN.toLowerCase().replace(
    LEADING_AT_REGEX,
    ""
  )}`;
  return value.trim().toLowerCase().endsWith(allowedDomain);
}

function formatAuthenticationMethodsError(error: unknown): string {
  const message = getErrorMessage(error);
  if (
    message.toLowerCase().includes("authorization") ||
    message.toLowerCase().includes("forbidden") ||
    message.toLowerCase().includes("access")
  ) {
    return "Microsoft Graph denied access to authentication methods. Grant the app UserAuthenticationMethod.Read.All application permission and admin consent, then retry.";
  }

  return message;
}

function buildProfilePatch(
  input: M365UserProfileUpdateInput
): M365UserProfileUpdateInput {
  return {
    userId: input.userId,
    accountEnabled: input.accountEnabled,
    businessPhones: input.businessPhones?.filter(Boolean),
    department: toNullableString(input.department),
    displayName: input.displayName?.trim(),
    givenName: toNullableString(input.givenName),
    jobTitle: toNullableString(input.jobTitle),
    mailNickname: input.mailNickname?.trim(),
    mobilePhone: toNullableString(input.mobilePhone),
    officeLocation: toNullableString(input.officeLocation),
    surname: toNullableString(input.surname),
    userPrincipalName: input.userPrincipalName?.trim(),
  };
}

async function loadItLookupOptions(): Promise<ItLookupOptions> {
  const { db } = await createAdminClient();
  const [campuses, departments] = await Promise.all([
    db.listRows<Campus>("app", "campus", [
      Query.orderAsc("name"),
      Query.limit(100),
    ]),
    db.listRows<Departments>("app", "departments", [
      Query.orderAsc("Name"),
      Query.limit(500),
    ]),
  ]);

  return {
    campuses: campuses.rows.map((campus) => ({
      id: campus.$id,
      name: campus.name,
      officeLocation: campus.name,
    })),
    departments: departments.rows
      .filter((department) => department.active !== false)
      .map((department) => ({
        id: department.$id,
        name: department.Name,
        campusId: department.campus_id,
      })),
  };
}

async function validateItLookupValues(input: {
  campusId?: string;
  department?: string | null;
  departmentId?: string;
  officeLocation?: string | null;
}): Promise<LookupValidationResult> {
  const options = await loadItLookupOptions();
  const result: LookupValidationResult = { options };

  if (input.campusId) {
    const campus = options.campuses.find((item) => item.id === input.campusId);
    if (!campus) {
      throw new Error("Selected campus is not valid.");
    }
    result.campus = campus;
  }

  if (input.officeLocation !== undefined) {
    const officeLocation = input.officeLocation?.trim();
    const campus = options.campuses.find(
      (item) => item.officeLocation === officeLocation
    );
    if (!campus) {
      throw new Error("Selected office location is not valid.");
    }
    result.campus = campus;
  }

  if (input.departmentId) {
    const department = options.departments.find(
      (item) => item.id === input.departmentId
    );
    if (!department) {
      throw new Error("Selected department is not valid.");
    }
    result.department = department;
  }

  if (input.department !== undefined) {
    const departmentName = input.department?.trim();
    const department = options.departments.find(
      (item) => item.name === departmentName
    );
    if (!department) {
      throw new Error("Selected department is not valid.");
    }
    result.department = department;
  }

  if (
    result.campus &&
    result.department &&
    result.department.campusId !== result.campus.id
  ) {
    throw new Error(
      "Selected department does not belong to the selected campus."
    );
  }

  return result;
}

async function getAllowedTenantUser(
  graph: GraphUserService,
  userId: string
): Promise<NonNullable<Awaited<ReturnType<GraphUserService["getUser"]>>>> {
  const user = await graph.getUser(userId);
  if (!user) {
    throw new Error("Microsoft 365 user not found");
  }
  if (!isAllowedTenantUser(user)) {
    throw new Error(
      "Only licensed @biso.no Microsoft 365 users are visible in IT admin."
    );
  }
  return user;
}

function getAccountStatusChange(input: {
  before: boolean | undefined;
  next: boolean | undefined;
}): { changed: boolean; confirmation: "DISABLE" | "ENABLE" | null } {
  if (input.before === undefined || input.next === undefined) {
    return { changed: false, confirmation: null };
  }
  if (input.before === input.next) {
    return { changed: false, confirmation: null };
  }
  return {
    changed: true,
    confirmation: input.next ? "ENABLE" : "DISABLE",
  };
}

async function requireAccountStatusConfirmation(input: {
  expected: "DISABLE" | "ENABLE" | null;
  provided?: string;
}): Promise<void> {
  if (!input.expected) {
    return;
  }

  await requireItPermission("it.users.disable");
  if (input.provided !== input.expected) {
    throw new Error(
      `Type ${input.expected} to confirm this account status change.`
    );
  }
}

async function writeItAudit(
  permission: M365Permission,
  action: string,
  payload: {
    error?: string;
    resourceId?: string;
    success: boolean;
    values?: Record<string, unknown>;
  }
): Promise<void> {
  const ctx = await requireItPermission(permission);
  await logAuditEvent(ctx, action, {
    resourceId: payload.resourceId,
    resourceType: "m365.user",
    payload: {
      success: payload.success,
      error: payload.error,
      ...payload.values,
    },
  });
}

export async function listItLookupOptions(): Promise<
  ActionResult<ItLookupOptions>
> {
  try {
    await requireItPermission("it.users.view");
    return { data: await loadItLookupOptions() };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function searchM365Users(input?: {
  limit?: number;
  query?: string;
}): Promise<ActionResult<M365UserListItem[]>> {
  try {
    await requireItPermission("it.users.view");
    const parsed = m365UserSearchSchema.parse({
      limit: input?.limit ?? 25,
      query: input?.query ?? "",
    });

    const users = await getGraphService().searchUsers(
      parsed.query,
      parsed.limit,
      {
        allowedDomain: M365_DOMAIN,
        licensedOnly: true,
      }
    );

    return { data: users.map(toListItem) };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function getM365UserDetail(
  userId: string
): Promise<ActionResult<M365UserDetail>> {
  try {
    await requireItPermission("it.users.view");
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, userId);

    let manager: M365UserListItem | null = null;
    try {
      const managerUser = await graph.getManager(user.id);
      manager = managerUser ? toListItem(managerUser) : null;
    } catch {
      manager = null;
    }

    return { data: toDetail(user, manager) };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function getUserGroups(
  userId: string
): Promise<ActionResult<M365UserGroup[]>> {
  try {
    await requireItPermission("it.users.view");
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, userId);
    const groups = await graph.getUserGroups(user.id);
    return {
      data: groups.map((group) => ({
        id: group.id,
        description: group.description ?? null,
        displayName: group.displayName,
        groupTypes: group.groupTypes ?? [],
        isTeamsRelated: group.groupTypes?.includes("Unified") ?? false,
        mail: group.mail ?? null,
        mailEnabled: group.mailEnabled,
        membershipType: "direct",
        securityEnabled: group.securityEnabled,
      })),
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function getUserLicenseDetails(
  userId: string
): Promise<ActionResult<M365UserLicenseDetail[]>> {
  try {
    await requireItPermission("it.users.view");
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, userId);
    const licenses = await graph.getUserLicenseDetails(user.id);
    return {
      data: licenses.map((license) => ({
        skuId: license.skuId,
        skuPartNumber: license.skuPartNumber ?? null,
        servicePlans: license.servicePlans.map((plan) => ({
          servicePlanId: plan.servicePlanId,
          servicePlanName: plan.servicePlanName ?? null,
          provisioningStatus: plan.provisioningStatus ?? null,
        })),
      })),
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function getAuthenticationMethodsSummary(userId: string) {
  try {
    await requireItPermission("it.users.viewSecurity");
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, userId);
    const methods = await graph.listAuthenticationMethods(user.id);
    return {
      data: {
        methods: methods.map((method) => ({
          id: method.id,
          odataType: method.odataType,
          type: method.type,
          displayName: method.displayName ?? null,
          createdDateTime: method.createdDateTime ?? null,
        })),
      },
    };
  } catch (error) {
    return {
      data: {
        methods: [],
        error: formatAuthenticationMethodsError(error),
      },
    };
  }
}

export async function checkAliasConflict(input: {
  alias: string;
  targetUserId?: string;
}): Promise<ActionResult<M365AliasConflictResult>> {
  try {
    await requireItPermission("it.users.manageAliases");
    const parsed = m365AliasConflictSchema.parse(input);
    if (parsed.targetUserId) {
      await getAllowedTenantUser(getGraphService(), parsed.targetUserId);
    }
    const conflict = await getGraphService().checkAliasConflict(parsed.alias);
    await writeItAudit("it.users.manageAliases", "it.m365.alias.check", {
      resourceId: parsed.targetUserId,
      success: true,
      values: {
        alias: conflict.alias,
        available: conflict.available,
        ownerType: conflict.owner?.type ?? null,
        requiresExchangeOnline: conflict.requiresExchangeOnline,
      },
    }).catch(() => undefined);
    return {
      data: {
        alias: conflict.alias,
        available: conflict.available,
        owner: conflict.owner
          ? {
              id: conflict.owner.id,
              displayName: conflict.owner.displayName ?? null,
              mail: conflict.owner.mail ?? null,
              type: conflict.owner.type,
              userPrincipalName: conflict.owner.userPrincipalName ?? null,
            }
          : undefined,
        requiresExchangeOnline: conflict.requiresExchangeOnline,
      },
    };
  } catch (error) {
    await writeItAudit("it.users.manageAliases", "it.m365.alias.check", {
      resourceId: input.targetUserId,
      success: false,
      error: getErrorMessage(error),
      values: { alias: input.alias },
    }).catch(() => undefined);
    return { error: getErrorMessage(error) };
  }
}

export async function checkUpnAvailability(input: unknown): Promise<
  ActionResult<{
    available: boolean;
    owner?: { displayName?: string | null; upn?: string | null };
  }>
> {
  try {
    await requireItPermission("it.users.editProfile");
    const parsed = m365UpnCheckSchema.parse(input);
    if (!isAllowedDomainValue(parsed.upn)) {
      return { data: { available: false } };
    }
    const graph = getGraphService();
    const conflict = await graph.checkAliasConflict(parsed.upn);
    // Self-match: the current user already owns this UPN
    if (!conflict.available && conflict.owner?.id === parsed.userId) {
      return { data: { available: true } };
    }
    return {
      data: {
        available: conflict.available,
        owner: conflict.owner
          ? {
              displayName: conflict.owner.displayName ?? null,
              upn: conflict.owner.userPrincipalName ?? null,
            }
          : undefined,
      },
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function addM365UserAlias(
  input: unknown
): Promise<ActionResult<void>> {
  try {
    const ctx = await requireItPermission("it.users.manageAliases");
    const parsed = m365AliasAddSchema.parse(input);
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, parsed.userId);

    const normalizedAlias = `smtp:${parsed.alias.toLowerCase()}`;
    const currentAddresses = user.proxyAddresses ?? [];
    if (currentAddresses.some((a) => a.toLowerCase() === normalizedAlias)) {
      throw new Error("This alias is already assigned to this user.");
    }

    const conflict = await graph.checkAliasConflict(parsed.alias);
    if (!conflict.available) {
      throw new Error("This alias is already in use by another user or group.");
    }

    await graph.updateProxyAddresses(parsed.userId, [
      ...currentAddresses,
      normalizedAlias,
    ]);

    await logAuditEvent(ctx, "it.m365.alias.add", {
      resourceId: parsed.userId,
      resourceType: "m365.user",
      payload: {
        alias: parsed.alias.toLowerCase(),
        userUpn: user.userPrincipalName,
      },
    });

    revalidatePath(`/it/users/${parsed.userId}`);
    return { data: undefined };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function removeM365UserAlias(
  input: unknown
): Promise<ActionResult<void>> {
  try {
    const ctx = await requireItPermission("it.users.manageAliases");
    const parsed = m365AliasRemoveSchema.parse(input);
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, parsed.userId);

    if (parsed.alias.startsWith("SMTP:")) {
      throw new Error(
        "The primary SMTP address cannot be removed. Change the mailbox primary address in Exchange Online first."
      );
    }

    const lower = parsed.alias.toLowerCase();
    const currentAddresses = user.proxyAddresses ?? [];
    if (!currentAddresses.some((a) => a.toLowerCase() === lower)) {
      throw new Error("This alias is not assigned to this user.");
    }

    await graph.updateProxyAddresses(
      parsed.userId,
      currentAddresses.filter((a) => a.toLowerCase() !== lower)
    );

    await logAuditEvent(ctx, "it.m365.alias.remove", {
      resourceId: parsed.userId,
      resourceType: "m365.user",
      payload: {
        alias: parsed.alias.replace(SMTP_PREFIX_REGEX, "").toLowerCase(),
        userUpn: user.userPrincipalName,
      },
    });

    revalidatePath(`/it/users/${parsed.userId}`);
    return { data: undefined };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function transferM365Alias(
  input: unknown
): Promise<ActionResult<void>> {
  try {
    const ctx = await requireItPermission("it.users.transferAlias");
    const parsed = m365AliasTransferSchema.parse(input);
    const graph = getGraphService();

    const [fromUser, toUser] = await Promise.all([
      getAllowedTenantUser(graph, parsed.fromUserId),
      getAllowedTenantUser(graph, parsed.toUserId),
    ]);

    const targetAlias = `smtp:${parsed.alias.toLowerCase()}`;
    const fromAddresses = fromUser.proxyAddresses ?? [];
    const toAddresses = toUser.proxyAddresses ?? [];

    if (
      fromAddresses.some(
        (a) => a.startsWith("SMTP:") && a.toLowerCase() === targetAlias
      )
    ) {
      throw new Error(
        "Cannot transfer the primary SMTP address. Change the primary address in Exchange Online first."
      );
    }

    if (!fromAddresses.some((a) => a.toLowerCase() === targetAlias)) {
      throw new Error("This alias is not assigned to the source user.");
    }

    if (parsed.replacementAlias) {
      const repConflict = await graph.checkAliasConflict(
        parsed.replacementAlias
      );
      if (!repConflict.available) {
        throw new Error(
          "The replacement alias is already in use by another user or group."
        );
      }
    }

    const newFromAddresses = fromAddresses.filter(
      (a) => a.toLowerCase() !== targetAlias
    );
    if (parsed.replacementAlias) {
      newFromAddresses.push(`smtp:${parsed.replacementAlias.toLowerCase()}`);
    }

    const newToAddresses = toAddresses.some(
      (a) => a.toLowerCase() === targetAlias
    )
      ? toAddresses
      : [...toAddresses, targetAlias];

    await graph.updateProxyAddresses(parsed.fromUserId, newFromAddresses);
    await graph.updateProxyAddresses(parsed.toUserId, newToAddresses);

    await logAuditEvent(ctx, "it.m365.alias.transfer", {
      resourceId: parsed.toUserId,
      resourceType: "m365.user",
      payload: {
        alias: parsed.alias.toLowerCase(),
        fromUserId: parsed.fromUserId,
        fromUserUpn: fromUser.userPrincipalName,
        replacementAlias: parsed.replacementAlias ?? null,
        toUserId: parsed.toUserId,
        toUserUpn: toUser.userPrincipalName,
      },
    });

    revalidatePath(`/it/users/${parsed.toUserId}`);
    revalidatePath(`/it/users/${parsed.fromUserId}`);
    return { data: undefined };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function createM365User(input: M365CreateUserInput): Promise<
  ActionResult<{
    temporaryPassword: string;
    user: M365UserListItem;
  }>
> {
  let parsed: M365CreateUserInput | null = null;

  try {
    const ctx = await requireItPermission("it.users.create");
    parsed = m365CreateUserSchema.parse(input);

    const { campus, department } = await validateItLookupValues({
      campusId: parsed.campusId,
      departmentId: parsed.departmentId,
    });
    if (!(campus && department)) {
      throw new Error("Selected campus and department are required.");
    }

    const displayName = `${parsed.givenName} ${parsed.surname}`.trim();
    const userPrincipalName =
      parsed.userPrincipalName ??
      generateUpn(parsed.givenName, parsed.surname, M365_DOMAIN);
    if (!isAllowedDomainValue(userPrincipalName)) {
      throw new Error(`User principal name must use @${M365_DOMAIN}.`);
    }
    const mailNickname =
      parsed.mailNickname ?? userPrincipalName.split("@")[0] ?? "";
    const temporaryPassword = generateTemporaryPassword();

    const graph = getGraphService();
    const graphUser = await graph.createUser({
      accountEnabled: parsed.accountEnabled,
      department: department.name,
      displayName,
      forceChangePasswordNextSignIn: parsed.forceChangePasswordNextSignIn,
      givenName: parsed.givenName,
      jobTitle: parsed.jobTitle,
      mailNickname,
      officeLocation: campus.officeLocation,
      password: temporaryPassword,
      surname: parsed.surname,
      userPrincipalName,
    });

    if (parsed.managerId) {
      await getAllowedTenantUser(graph, parsed.managerId);
      await graph.setManager(graphUser.id, parsed.managerId);
    }

    try {
      const { db } = await createAdminClient();
      await db.createRow("app", "user", graphUser.id, {
        name: displayName,
        email: userPrincipalName,
        campus_id: parsed.campusId,
        department_ids: [parsed.departmentId],
        isActive: parsed.accountEnabled,
      });
    } catch (error) {
      await logAuditEvent(ctx, "it.m365.user.create", {
        resourceId: graphUser.id,
        resourceType: "m365.user",
        payload: {
          success: false,
          userPrincipalName,
          campusId: parsed.campusId,
          departmentId: parsed.departmentId,
          graphUserCreated: true,
          appwriteSyncFailed: true,
          manualCleanupRequired: true,
          error: getErrorMessage(error),
        },
      });
      throw new Error(
        "Microsoft 365 user was created, but the Appwrite profile sync failed. Manual cleanup is required before retrying."
      );
    }

    await logAuditEvent(ctx, "it.m365.user.create", {
      resourceId: graphUser.id,
      resourceType: "m365.user",
      payload: {
        success: true,
        userPrincipalName,
        campusId: parsed.campusId,
        departmentId: parsed.departmentId,
        managerId: parsed.managerId ?? null,
      },
    });

    revalidatePath("/it/users");
    return {
      data: {
        temporaryPassword,
        user: toListItem(graphUser),
      },
    };
  } catch (error) {
    await writeItAudit("it.users.create", "it.m365.user.create", {
      success: false,
      error: getErrorMessage(error),
      values: parsed ? { userPrincipalName: parsed.userPrincipalName } : {},
    }).catch(() => undefined);

    return { error: getErrorMessage(error) };
  }
}

// ============================================================================
// Phase 2 — Manager, Groups, Licenses, MFA, Password, Sessions
// ============================================================================

export async function updateM365UserManager(
  input: M365ManagerUpdateInput
): Promise<ActionResult<void>> {
  let parsed: M365ManagerUpdateInput | null = null;
  try {
    parsed = m365ManagerUpdateSchema.parse(input);
    await requireItPermission("it.users.manageManagers");
    const graph = getGraphService();
    const [user, managerUser] = await Promise.all([
      getAllowedTenantUser(graph, parsed.userId),
      getAllowedTenantUser(graph, parsed.managerId),
    ]);
    const before = await graph.getManager(user.id);
    await graph.setManager(user.id, managerUser.id);
    await writeItAudit(
      "it.users.manageManagers",
      "it.m365.user.manager.update",
      {
        resourceId: user.id,
        success: true,
        values: {
          before: before
            ? { displayName: before.displayName, upn: before.userPrincipalName }
            : null,
          after: {
            displayName: managerUser.displayName,
            upn: managerUser.userPrincipalName,
          },
        },
      }
    );
    revalidatePath(`/it/users/${parsed.userId}`);
    return { data: undefined };
  } catch (error) {
    await writeItAudit(
      "it.users.manageManagers",
      "it.m365.user.manager.update",
      {
        resourceId: parsed?.userId,
        success: false,
        error: getErrorMessage(error),
      }
    ).catch(() => undefined);
    return { error: getErrorMessage(error) };
  }
}

export async function removeM365UserManager(input: {
  userId: string;
}): Promise<ActionResult<void>> {
  let parsed: { userId: string } | null = null;
  try {
    parsed = m365UserIdSchema.parse(input);
    await requireItPermission("it.users.manageManagers");
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, parsed.userId);
    const before = await graph.getManager(user.id);
    await graph.removeManager(user.id);
    await writeItAudit(
      "it.users.manageManagers",
      "it.m365.user.manager.remove",
      {
        resourceId: user.id,
        success: true,
        values: {
          before: before
            ? { displayName: before.displayName, upn: before.userPrincipalName }
            : null,
        },
      }
    );
    revalidatePath(`/it/users/${parsed.userId}`);
    return { data: undefined };
  } catch (error) {
    await writeItAudit(
      "it.users.manageManagers",
      "it.m365.user.manager.remove",
      {
        resourceId: parsed?.userId,
        success: false,
        error: getErrorMessage(error),
      }
    ).catch(() => undefined);
    return { error: getErrorMessage(error) };
  }
}

export async function searchM365Groups(input?: {
  limit?: number;
  query?: string;
}): Promise<ActionResult<M365UserGroup[]>> {
  try {
    await requireItPermission("it.users.manageGroups");
    const parsed = m365GroupSearchSchema.parse({
      query: input?.query ?? "",
      limit: input?.limit ?? 25,
    });
    const groups = await getGraphService().searchGroups(
      parsed.query,
      parsed.limit
    );
    return {
      data: groups.map((g) => ({
        id: g.id,
        description: g.description ?? null,
        displayName: g.displayName,
        groupTypes: g.groupTypes ?? [],
        isTeamsRelated: g.groupTypes?.includes("Unified") ?? false,
        mail: g.mail ?? null,
        mailEnabled: g.mailEnabled,
        membershipType: "direct" as const,
        securityEnabled: g.securityEnabled,
      })),
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function addM365UserToGroup(
  input: M365GroupMembershipInput
): Promise<ActionResult<void>> {
  let parsed: M365GroupMembershipInput | null = null;
  try {
    parsed = m365GroupMembershipSchema.parse(input);
    await requireItPermission("it.users.manageGroups");
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, parsed.userId);
    const group = await graph.getGroup(parsed.groupId);
    if (!group) {
      throw new Error("Group not found.");
    }
    await graph.addUserToGroup(user.id, group.id);
    await writeItAudit("it.users.manageGroups", "it.m365.user.group.add", {
      resourceId: user.id,
      success: true,
      values: {
        groupId: group.id,
        groupDisplayName: group.displayName,
        userUpn: user.userPrincipalName,
      },
    });
    revalidatePath(`/it/users/${parsed.userId}`);
    return { data: undefined };
  } catch (error) {
    await writeItAudit("it.users.manageGroups", "it.m365.user.group.add", {
      resourceId: parsed?.userId,
      success: false,
      error: getErrorMessage(error),
      values: { groupId: parsed?.groupId },
    }).catch(() => undefined);
    return { error: getErrorMessage(error) };
  }
}

export async function removeM365UserFromGroup(
  input: M365GroupMembershipInput
): Promise<ActionResult<void>> {
  let parsed: M365GroupMembershipInput | null = null;
  try {
    parsed = m365GroupMembershipSchema.parse(input);
    await requireItPermission("it.users.manageGroups");
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, parsed.userId);
    const group = await graph.getGroup(parsed.groupId);
    await graph.removeUserFromGroup(user.id, parsed.groupId);
    await writeItAudit("it.users.manageGroups", "it.m365.user.group.remove", {
      resourceId: user.id,
      success: true,
      values: {
        groupId: parsed.groupId,
        groupDisplayName: group?.displayName ?? null,
        userUpn: user.userPrincipalName,
      },
    });
    revalidatePath(`/it/users/${parsed.userId}`);
    return { data: undefined };
  } catch (error) {
    await writeItAudit("it.users.manageGroups", "it.m365.user.group.remove", {
      resourceId: parsed?.userId,
      success: false,
      error: getErrorMessage(error),
      values: { groupId: parsed?.groupId },
    }).catch(() => undefined);
    return { error: getErrorMessage(error) };
  }
}

export async function listM365SubscribedSkus(): Promise<
  ActionResult<M365SubscribedSku[]>
> {
  try {
    await requireItPermission("it.users.manageLicenses");
    const skus = await getGraphService().listSubscribedSkus();
    return {
      data: skus.map((sku) => ({
        skuId: sku.skuId,
        skuPartNumber: sku.skuPartNumber,
        consumedUnits: sku.consumedUnits,
        prepaidUnits: sku.prepaidUnits,
      })),
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function assignM365License(
  input: M365LicenseManageInput
): Promise<ActionResult<void>> {
  let parsed: M365LicenseManageInput | null = null;
  try {
    parsed = m365LicenseManageSchema.parse(input);
    await requireItPermission("it.users.manageLicenses");
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, parsed.userId);
    await graph.manageLicense(user.id, [parsed.skuId], []);
    await writeItAudit(
      "it.users.manageLicenses",
      "it.m365.user.license.assign",
      {
        resourceId: user.id,
        success: true,
        values: { skuId: parsed.skuId, userUpn: user.userPrincipalName },
      }
    );
    revalidatePath(`/it/users/${parsed.userId}`);
    return { data: undefined };
  } catch (error) {
    await writeItAudit(
      "it.users.manageLicenses",
      "it.m365.user.license.assign",
      {
        resourceId: parsed?.userId,
        success: false,
        error: getErrorMessage(error),
        values: { skuId: parsed?.skuId },
      }
    ).catch(() => undefined);
    return { error: getErrorMessage(error) };
  }
}

export async function removeM365License(
  input: M365LicenseManageInput
): Promise<ActionResult<void>> {
  let parsed: M365LicenseManageInput | null = null;
  try {
    parsed = m365LicenseManageSchema.parse(input);
    await requireItPermission("it.users.manageLicenses");
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, parsed.userId);
    await graph.manageLicense(user.id, [], [parsed.skuId]);
    await writeItAudit(
      "it.users.manageLicenses",
      "it.m365.user.license.remove",
      {
        resourceId: user.id,
        success: true,
        values: { skuId: parsed.skuId, userUpn: user.userPrincipalName },
      }
    );
    revalidatePath(`/it/users/${parsed.userId}`);
    return { data: undefined };
  } catch (error) {
    await writeItAudit(
      "it.users.manageLicenses",
      "it.m365.user.license.remove",
      {
        resourceId: parsed?.userId,
        success: false,
        error: getErrorMessage(error),
        values: { skuId: parsed?.skuId },
      }
    ).catch(() => undefined);
    return { error: getErrorMessage(error) };
  }
}

export async function resetM365Mfa(input: {
  userId: string;
}): Promise<ActionResult<{ removedCount: number }>> {
  let parsed: { userId: string } | null = null;
  try {
    parsed = m365UserIdSchema.parse(input);
    await requireItPermission("it.users.resetMfa");
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, parsed.userId);
    const methods = await graph.listAuthenticationMethods(user.id);
    const PASSWORD_METHOD = "#microsoft.graph.passwordAuthenticationMethod";
    const toRemove = methods.filter((m) => m.odataType !== PASSWORD_METHOD);
    const removedTypes: string[] = [];
    for (const method of toRemove) {
      await graph.deleteAuthenticationMethod(
        user.id,
        method.id,
        method.odataType
      );
      removedTypes.push(method.type);
    }
    await writeItAudit("it.users.resetMfa", "it.m365.user.mfa.reset", {
      resourceId: user.id,
      success: true,
      values: {
        removedMethodTypes: removedTypes,
        removedCount: toRemove.length,
        userUpn: user.userPrincipalName,
      },
    });
    revalidatePath(`/it/users/${parsed.userId}`);
    return { data: { removedCount: toRemove.length } };
  } catch (error) {
    await writeItAudit("it.users.resetMfa", "it.m365.user.mfa.reset", {
      resourceId: parsed?.userId,
      success: false,
      error: getErrorMessage(error),
    }).catch(() => undefined);
    return { error: getErrorMessage(error) };
  }
}

export async function forcePasswordResetNextSignIn(input: {
  userId: string;
}): Promise<ActionResult<void>> {
  let parsed: { userId: string } | null = null;
  try {
    parsed = m365UserIdSchema.parse(input);
    await requireItPermission("it.users.resetPassword");
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, parsed.userId);
    await graph.forcePasswordResetNextSignIn(user.id);
    await writeItAudit(
      "it.users.resetPassword",
      "it.m365.user.password.forceReset",
      {
        resourceId: user.id,
        success: true,
        values: { operation: "forceReset", userUpn: user.userPrincipalName },
      }
    );
    revalidatePath(`/it/users/${parsed.userId}`);
    return { data: undefined };
  } catch (error) {
    await writeItAudit(
      "it.users.resetPassword",
      "it.m365.user.password.forceReset",
      {
        resourceId: parsed?.userId,
        success: false,
        error: getErrorMessage(error),
      }
    ).catch(() => undefined);
    return { error: getErrorMessage(error) };
  }
}

export async function resetM365Password(input: {
  userId: string;
}): Promise<ActionResult<{ temporaryPassword: string }>> {
  let parsed: { userId: string } | null = null;
  try {
    parsed = m365UserIdSchema.parse(input);
    await requireItPermission("it.users.resetPassword");
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, parsed.userId);
    const temporaryPassword = generateTemporaryPassword();
    await graph.resetPassword(user.id, temporaryPassword);
    await writeItAudit(
      "it.users.resetPassword",
      "it.m365.user.password.reset",
      {
        resourceId: user.id,
        success: true,
        values: { operation: "resetPassword", userUpn: user.userPrincipalName },
      }
    );
    revalidatePath(`/it/users/${parsed.userId}`);
    return { data: { temporaryPassword } };
  } catch (error) {
    await writeItAudit(
      "it.users.resetPassword",
      "it.m365.user.password.reset",
      {
        resourceId: parsed?.userId,
        success: false,
        error: getErrorMessage(error),
      }
    ).catch(() => undefined);
    return { error: getErrorMessage(error) };
  }
}

export async function revokeM365SignInSessions(input: {
  userId: string;
}): Promise<ActionResult<void>> {
  let parsed: { userId: string } | null = null;
  try {
    parsed = m365UserIdSchema.parse(input);
    await requireItPermission("it.users.revokeSessions");
    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, parsed.userId);
    await graph.revokeSignInSessions(user.id);
    await writeItAudit(
      "it.users.revokeSessions",
      "it.m365.user.sessions.revoke",
      {
        resourceId: user.id,
        success: true,
        values: { userUpn: user.userPrincipalName },
      }
    );
    return { data: undefined };
  } catch (error) {
    await writeItAudit(
      "it.users.revokeSessions",
      "it.m365.user.sessions.revoke",
      {
        resourceId: parsed?.userId,
        success: false,
        error: getErrorMessage(error),
      }
    ).catch(() => undefined);
    return { error: getErrorMessage(error) };
  }
}

export async function updateM365UserProfile(
  input: M365UserProfileUpdateInput
): Promise<ActionResult<M365UserDetail>> {
  let parsed: M365UserProfileUpdateInput | null = null;

  try {
    parsed = m365UserProfileUpdateSchema.parse(input);
    await requireItPermission("it.users.editProfile");

    const graph = getGraphService();
    const before = await getAllowedTenantUser(graph, parsed.userId);
    const accountStatusChange = getAccountStatusChange({
      before: before.accountEnabled,
      next: parsed.accountEnabled,
    });
    await requireAccountStatusConfirmation({
      expected: accountStatusChange.confirmation,
      provided: parsed.accountStatusConfirmation,
    });

    if (
      parsed.userPrincipalName &&
      !isAllowedDomainValue(parsed.userPrincipalName)
    ) {
      throw new Error(`User principal name must use @${M365_DOMAIN}.`);
    }

    await validateItLookupValues({
      department: parsed.department,
      officeLocation: parsed.officeLocation,
    });

    const {
      accountStatusConfirmation: _accountStatusConfirmation,
      userId: _userId,
      ...patch
    } = buildProfilePatch(parsed);
    await graph.updateUser(parsed.userId, patch);

    const after = await getAllowedTenantUser(graph, parsed.userId);

    await writeItAudit(
      accountStatusChange.changed ? "it.users.disable" : "it.users.editProfile",
      accountStatusChange.changed
        ? "it.m365.user.accountStatus.update"
        : "it.m365.user.update",
      {
        resourceId: parsed.userId,
        success: true,
        values: {
          before: {
            accountEnabled: before.accountEnabled ?? null,
            department: before.department ?? null,
            displayName: before.displayName,
            jobTitle: before.jobTitle ?? null,
            officeLocation: before.officeLocation ?? null,
            userPrincipalName: before.userPrincipalName,
          },
          after: {
            accountEnabled: after.accountEnabled ?? null,
            department: after.department ?? null,
            displayName: after.displayName,
            jobTitle: after.jobTitle ?? null,
            officeLocation: after.officeLocation ?? null,
            userPrincipalName: after.userPrincipalName,
          },
        },
      }
    );

    revalidatePath("/it/users");
    revalidatePath(`/it/users/${parsed.userId}`);
    return { data: toDetail(after, null) };
  } catch (error) {
    await writeItAudit(
      parsed?.accountEnabled === false
        ? "it.users.disable"
        : "it.users.editProfile",
      parsed?.accountEnabled === false
        ? "it.m365.user.accountStatus.update"
        : "it.m365.user.update",
      {
        resourceId: parsed?.userId,
        success: false,
        error: getErrorMessage(error),
      }
    ).catch(() => undefined);

    return { error: getErrorMessage(error) };
  }
}
