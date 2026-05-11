import { randomInt } from "node:crypto";
import type { Client } from "@microsoft/microsoft-graph-client";
import { createGraphClient } from "./index";

// ============================================================================
// Types
// ============================================================================

export interface GraphUserCreateInput {
  accountEnabled?: boolean;
  department?: string;
  displayName: string;
  forceChangePasswordNextSignIn?: boolean;
  givenName?: string;
  jobTitle?: string;
  mailNickname: string;
  officeLocation?: string;
  password: string;
  surname?: string;
  userPrincipalName: string;
}

export interface GraphUser {
  accountEnabled?: boolean;
  assignedLicenses?: Array<{ skuId: string }>;
  businessPhones?: string[];
  createdDateTime?: string;
  department?: string;
  displayName: string;
  employeeId?: string;
  givenName?: string;
  id: string;
  jobTitle?: string;
  lastSignInDateTime?: string;
  mail?: string;
  mailNickname?: string;
  mobilePhone?: string;
  officeLocation?: string;
  proxyAddresses?: string[];
  surname?: string;
  userPrincipalName: string;
}

export interface GraphGroup {
  description?: string;
  displayName: string;
  groupTypes?: string[];
  id: string;
  mail?: string;
  mailEnabled: boolean;
  securityEnabled: boolean;
}

export interface GraphLicenseDetail {
  servicePlans: Array<{
    provisioningStatus?: string;
    servicePlanId: string;
    servicePlanName?: string;
  }>;
  skuId: string;
  skuPartNumber?: string;
}

export interface GraphAuthenticationMethod {
  createdDateTime?: string;
  displayName?: string;
  id: string;
  odataType: string;
  type: string;
}

export interface GraphSubscribedSku {
  consumedUnits: number;
  prepaidUnits: { enabled: number; suspended: number; warning: number };
  skuId: string;
  skuPartNumber: string;
}

export interface GraphAliasConflict {
  alias: string;
  available: boolean;
  owner?: {
    displayName?: string;
    id: string;
    mail?: string;
    type: "user" | "group" | "unknown";
    userPrincipalName?: string;
  };
  requiresExchangeOnline: boolean;
}

export type GraphUserProfileUpdate = Partial<{
  accountEnabled: boolean;
  businessPhones: string[];
  department: string | null;
  displayName: string;
  givenName: string | null;
  jobTitle: string | null;
  mailNickname: string;
  mobilePhone: string | null;
  officeLocation: string | null;
  surname: string | null;
  userPrincipalName: string;
}>;

export interface GraphUserSearchOptions {
  allowedDomain?: string;
  licensedOnly?: boolean;
}

const USER_SELECT = [
  "id",
  "displayName",
  "givenName",
  "surname",
  "userPrincipalName",
  "mail",
  "mailNickname",
  "jobTitle",
  "department",
  "officeLocation",
  "mobilePhone",
  "businessPhones",
  "accountEnabled",
  "createdDateTime",
  "employeeId",
  "assignedLicenses",
  "proxyAddresses",
] as const;
const USER_SELECT_WITH_SIGN_IN = [...USER_SELECT, "signInActivity"] as const;
const LEADING_AT_REGEX = /^@/;
const GRAPH_SECRET_PATTERNS = [
  /client_secret=[^&\s]+/gi,
  /access_token=[^&\s]+/gi,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
] as const;
const GRAPH_AUTHORIZATION_ERROR_REGEX =
  /authorization|forbidden|access denied/i;
const GRAPH_CONFLICT_ERROR_REGEX =
  /already exists|objectConflict|Request_BadRequest/i;

function escapeODataString(value: string): string {
  return value.replaceAll("'", "''");
}

function getStatusCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    return Number((error as { statusCode?: unknown }).statusCode);
  }
  return;
}

function encodeGraphPathSegment(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) {
    throw new Error("Microsoft Graph object id is required");
  }

  return encodeURIComponent(trimmed);
}

export function normalizeGraphError(error: unknown): Error {
  let rawMessage = "Microsoft Graph request failed";
  if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === "string") {
    rawMessage = error;
  }
  const message = GRAPH_SECRET_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, "[redacted]"),
    rawMessage
  );
  const statusCode = getStatusCode(error);

  if (statusCode === 403 || GRAPH_AUTHORIZATION_ERROR_REGEX.test(message)) {
    return new Error(
      "Microsoft Graph denied this request. Check application permissions and admin consent."
    );
  }
  if (statusCode === 404) {
    return new Error("Microsoft Graph resource was not found.");
  }
  if (GRAPH_CONFLICT_ERROR_REGEX.test(message)) {
    return new Error(message);
  }

  return new Error(message);
}

function toGraphUser(user: Record<string, unknown>): GraphUser {
  const signInActivity = user.signInActivity as
    | { lastSignInDateTime?: string }
    | undefined;

  return {
    id: String(user.id ?? ""),
    displayName: String(user.displayName ?? ""),
    userPrincipalName: String(user.userPrincipalName ?? ""),
    mail: typeof user.mail === "string" ? user.mail : undefined,
    givenName: typeof user.givenName === "string" ? user.givenName : undefined,
    surname: typeof user.surname === "string" ? user.surname : undefined,
    mailNickname:
      typeof user.mailNickname === "string" ? user.mailNickname : undefined,
    department:
      typeof user.department === "string" ? user.department : undefined,
    officeLocation:
      typeof user.officeLocation === "string" ? user.officeLocation : undefined,
    jobTitle: typeof user.jobTitle === "string" ? user.jobTitle : undefined,
    mobilePhone:
      typeof user.mobilePhone === "string" ? user.mobilePhone : undefined,
    businessPhones: Array.isArray(user.businessPhones)
      ? user.businessPhones.filter(
          (phone): phone is string => typeof phone === "string"
        )
      : undefined,
    accountEnabled:
      typeof user.accountEnabled === "boolean"
        ? user.accountEnabled
        : undefined,
    createdDateTime:
      typeof user.createdDateTime === "string"
        ? user.createdDateTime
        : undefined,
    employeeId:
      typeof user.employeeId === "string" ? user.employeeId : undefined,
    assignedLicenses: Array.isArray(user.assignedLicenses)
      ? user.assignedLicenses
          .map((license) => {
            if (
              typeof license === "object" &&
              license !== null &&
              "skuId" in license &&
              typeof license.skuId === "string"
            ) {
              return { skuId: license.skuId };
            }
            return null;
          })
          .filter((license): license is { skuId: string } => license !== null)
      : undefined,
    proxyAddresses: Array.isArray(user.proxyAddresses)
      ? user.proxyAddresses.filter(
          (address): address is string => typeof address === "string"
        )
      : undefined,
    lastSignInDateTime: signInActivity?.lastSignInDateTime,
  };
}

function normalizeDomain(domain?: string): string | null {
  const cleaned = domain?.trim().toLowerCase().replace(LEADING_AT_REGEX, "");
  return cleaned ? `@${cleaned}` : null;
}

function hasAllowedDomain(user: GraphUser, allowedDomain?: string): boolean {
  const normalizedDomain = normalizeDomain(allowedDomain);
  if (!normalizedDomain) {
    return true;
  }

  return [user.userPrincipalName, user.mail]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().endsWith(normalizedDomain));
}

function hasAssignedLicense(user: GraphUser): boolean {
  return (user.assignedLicenses?.length ?? 0) > 0;
}

// ============================================================================
// User Management Service
// ============================================================================

export class GraphUserService {
  private readonly client: Client;

  constructor(tenantId: string, clientId: string, clientSecret: string) {
    this.client = createGraphClient(tenantId, clientId, clientSecret);
  }

  // --------------------------------------------------------------------------
  // User Operations
  // --------------------------------------------------------------------------

  /**
   * Create a new user in Azure AD / Entra ID
   */
  async createUser(input: GraphUserCreateInput): Promise<GraphUser> {
    const response = await this.client.api("/users").post({
      accountEnabled: input.accountEnabled ?? true,
      displayName: input.displayName,
      userPrincipalName: input.userPrincipalName,
      mailNickname: input.mailNickname,
      givenName: input.givenName,
      surname: input.surname,
      jobTitle: input.jobTitle,
      department: input.department,
      officeLocation: input.officeLocation,
      passwordProfile: {
        password: input.password,
        forceChangePasswordNextSignIn:
          input.forceChangePasswordNextSignIn ?? true,
      },
    });

    return toGraphUser(response);
  }

  /**
   * Update user attributes
   */
  async updateUser(
    userId: string,
    updates: GraphUserProfileUpdate
  ): Promise<void> {
    try {
      await this.client
        .api(`/users/${encodeGraphPathSegment(userId)}`)
        .patch(updates);
    } catch (error) {
      throw normalizeGraphError(error);
    }
  }

  /**
   * Replace the proxyAddresses array for a user (Exchange mailbox must be provisioned).
   * Send the full desired array — Graph replaces it entirely.
   */
  async updateProxyAddresses(
    userId: string,
    proxyAddresses: string[]
  ): Promise<void> {
    try {
      await this.client
        .api(`/users/${encodeGraphPathSegment(userId)}`)
        .patch({ proxyAddresses });
    } catch (error) {
      throw normalizeGraphError(error);
    }
  }

  /**
   * Get a user by ID or UPN
   */
  async getUser(userIdOrUpn: string): Promise<GraphUser | null> {
    try {
      const userSegment = encodeGraphPathSegment(userIdOrUpn);
      const response = await this.client
        .api(`/users/${userSegment}`)
        .select(USER_SELECT_WITH_SIGN_IN.join(","))
        .get();

      return toGraphUser(response);
    } catch (error: unknown) {
      if (getStatusCode(error) === 404) {
        return null;
      }
      if (getStatusCode(error) === 403 || getStatusCode(error) === 400) {
        const userSegment = encodeGraphPathSegment(userIdOrUpn);
        const response = await this.client
          .api(`/users/${userSegment}`)
          .select(USER_SELECT.join(","))
          .get();

        return toGraphUser(response);
      }
      throw normalizeGraphError(error);
    }
  }

  /**
   * Search users by display name or UPN
   */
  async searchUsers(
    query: string,
    limit = 20,
    options: GraphUserSearchOptions = {}
  ): Promise<GraphUser[]> {
    const sanitizedQuery = escapeODataString(query.trim());

    let request = this.client
      .api("/users")
      .select(USER_SELECT_WITH_SIGN_IN.join(","));

    if (sanitizedQuery) {
      request = request.filter(
        `startswith(displayName,'${sanitizedQuery}') or startswith(userPrincipalName,'${sanitizedQuery}') or startswith(mail,'${sanitizedQuery}')`
      );
    }

    const requestLimit = Math.min(Math.max(limit * 4, 100), 999);
    let response: { value: Record<string, unknown>[] };
    try {
      response = await request.top(Math.min(requestLimit, 500)).get();
    } catch (error) {
      if (getStatusCode(error) !== 403 && getStatusCode(error) !== 400) {
        throw normalizeGraphError(error);
      }

      request = this.client.api("/users").select(USER_SELECT.join(","));
      if (sanitizedQuery) {
        request = request.filter(
          `startswith(displayName,'${sanitizedQuery}') or startswith(userPrincipalName,'${sanitizedQuery}') or startswith(mail,'${sanitizedQuery}')`
        );
      }
      response = await request.top(requestLimit).get();
    }

    return response.value
      .map((user: Record<string, unknown>) => toGraphUser(user))
      .filter((user: GraphUser) =>
        hasAllowedDomain(user, options.allowedDomain)
      )
      .filter((user: GraphUser) =>
        options.licensedOnly ? hasAssignedLicense(user) : true
      )
      .slice(0, limit);
  }

  /**
   * Check Graph-visible users and groups for a proxy address/mail conflict.
   * Exchange Online remains the authority for mailbox-only recipient types.
   */
  async checkAliasConflict(alias: string): Promise<GraphAliasConflict> {
    const normalizedAlias = alias.trim().toLowerCase();
    const escapedAlias = escapeODataString(`smtp:${normalizedAlias}`);
    const escapedPrimaryAlias = escapeODataString(`SMTP:${normalizedAlias}`);

    try {
      const userResponse = await this.client
        .api("/users")
        .header("ConsistencyLevel", "eventual")
        .filter(
          `proxyAddresses/any(address:address eq '${escapedAlias}' or address eq '${escapedPrimaryAlias}') or mail eq '${escapeODataString(normalizedAlias)}' or userPrincipalName eq '${escapeODataString(normalizedAlias)}'`
        )
        .select("id,displayName,userPrincipalName,mail")
        .top(1)
        .get();

      if (userResponse.value?.[0]) {
        const owner = userResponse.value[0] as Record<string, unknown>;
        return {
          alias: normalizedAlias,
          available: false,
          requiresExchangeOnline: false,
          owner: {
            id: String(owner.id ?? ""),
            displayName:
              typeof owner.displayName === "string"
                ? owner.displayName
                : undefined,
            mail: typeof owner.mail === "string" ? owner.mail : undefined,
            type: "user",
            userPrincipalName:
              typeof owner.userPrincipalName === "string"
                ? owner.userPrincipalName
                : undefined,
          },
        };
      }

      const groupResponse = await this.client
        .api("/groups")
        .header("ConsistencyLevel", "eventual")
        .filter(
          `proxyAddresses/any(address:address eq '${escapedAlias}' or address eq '${escapedPrimaryAlias}') or mail eq '${escapeODataString(normalizedAlias)}'`
        )
        .select("id,displayName,mail,mailEnabled,securityEnabled,groupTypes")
        .top(1)
        .get();

      if (groupResponse.value?.[0]) {
        const owner = groupResponse.value[0] as Record<string, unknown>;
        return {
          alias: normalizedAlias,
          available: false,
          requiresExchangeOnline: false,
          owner: {
            id: String(owner.id ?? ""),
            displayName:
              typeof owner.displayName === "string"
                ? owner.displayName
                : undefined,
            mail: typeof owner.mail === "string" ? owner.mail : undefined,
            type: "group",
          },
        };
      }
    } catch (error) {
      throw normalizeGraphError(error);
    }

    return {
      alias: normalizedAlias,
      available: true,
      requiresExchangeOnline: true,
    };
  }

  // --------------------------------------------------------------------------
  // Manager Operations
  // --------------------------------------------------------------------------

  /**
   * Set the manager for a user
   */
  async setManager(userId: string, managerId: string): Promise<void> {
    const userSegment = encodeGraphPathSegment(userId);
    const managerSegment = encodeGraphPathSegment(managerId);
    await this.client.api(`/users/${userSegment}/manager/$ref`).put({
      "@odata.id": `https://graph.microsoft.com/v1.0/users/${managerSegment}`,
    });
  }

  /**
   * Remove the manager from a user
   */
  async removeManager(userId: string): Promise<void> {
    try {
      await this.client
        .api(`/users/${encodeGraphPathSegment(userId)}/manager/$ref`)
        .delete();
    } catch (error: unknown) {
      // Ignore 404 - user might not have a manager
      if (getStatusCode(error) !== 404) {
        throw error;
      }
    }
  }

  /**
   * Get the manager of a user
   */
  async getManager(userId: string): Promise<GraphUser | null> {
    try {
      const userSegment = encodeGraphPathSegment(userId);
      const response = await this.client
        .api(`/users/${userSegment}/manager`)
        .select(USER_SELECT.join(","))
        .get();

      return toGraphUser(response);
    } catch (error: unknown) {
      if (getStatusCode(error) === 404) {
        return null;
      }
      throw normalizeGraphError(error);
    }
  }

  // --------------------------------------------------------------------------
  // Group Operations
  // --------------------------------------------------------------------------

  /**
   * Get groups that a user is a member of
   */
  async getUserGroups(userId: string): Promise<GraphGroup[]> {
    const response = await this.client
      .api(`/users/${encodeGraphPathSegment(userId)}/memberOf`)
      .select(
        "id,displayName,description,securityEnabled,mailEnabled,mail,groupTypes"
      )
      .get();

    return response.value
      .filter(
        (item: Record<string, unknown>) =>
          item["@odata.type"] === "#microsoft.graph.group"
      )
      .map((group: Record<string, unknown>) => ({
        id: String(group.id ?? ""),
        displayName: String(group.displayName ?? ""),
        description:
          typeof group.description === "string" ? group.description : undefined,
        securityEnabled: group.securityEnabled === true,
        mailEnabled: group.mailEnabled === true,
        mail: typeof group.mail === "string" ? group.mail : undefined,
        groupTypes: Array.isArray(group.groupTypes)
          ? group.groupTypes.filter(
              (groupType): groupType is string => typeof groupType === "string"
            )
          : [],
      }));
  }

  /**
   * Add a user to a group
   */
  async addUserToGroup(userId: string, groupId: string): Promise<void> {
    try {
      const groupSegment = encodeGraphPathSegment(groupId);
      const userSegment = encodeGraphPathSegment(userId);
      await this.client.api(`/groups/${groupSegment}/members/$ref`).post({
        "@odata.id": `https://graph.microsoft.com/v1.0/users/${userSegment}`,
      });
    } catch (error: unknown) {
      // Ignore 400 with "already exists" - user is already a member
      const message = error instanceof Error ? error.message : "";
      if (getStatusCode(error) === 400 && message.includes("already exist")) {
        return;
      }
      throw error;
    }
  }

  /**
   * Remove a user from a group
   */
  async removeUserFromGroup(userId: string, groupId: string): Promise<void> {
    try {
      const groupSegment = encodeGraphPathSegment(groupId);
      const userSegment = encodeGraphPathSegment(userId);
      await this.client
        .api(`/groups/${groupSegment}/members/${userSegment}/$ref`)
        .delete();
    } catch (error: unknown) {
      // Ignore 404 - user might not be in the group
      if (getStatusCode(error) !== 404) {
        throw error;
      }
    }
  }

  /**
   * Add a user to multiple groups
   */
  async addUserToGroups(
    userId: string,
    groupIds: string[]
  ): Promise<{
    succeeded: string[];
    failed: Array<{ groupId: string; error: string }>;
  }> {
    const succeeded: string[] = [];
    const failed: Array<{ groupId: string; error: string }> = [];

    for (const groupId of groupIds) {
      try {
        await this.addUserToGroup(userId, groupId);
        succeeded.push(groupId);
      } catch (error: unknown) {
        failed.push({
          groupId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { succeeded, failed };
  }

  /**
   * Search for groups by display name
   */
  async searchGroups(query: string, limit = 50): Promise<GraphGroup[]> {
    const filter = `startswith(displayName,'${escapeODataString(query)}')`;

    const response = await this.client
      .api("/groups")
      .filter(filter)
      .select(
        "id,displayName,description,securityEnabled,mailEnabled,mail,groupTypes"
      )
      .top(limit)
      .get();

    return response.value.map((group: Record<string, unknown>) => ({
      id: group.id,
      displayName: group.displayName,
      description: group.description,
      securityEnabled: group.securityEnabled,
      mailEnabled: group.mailEnabled,
      mail: group.mail,
      groupTypes: Array.isArray(group.groupTypes)
        ? group.groupTypes.filter(
            (groupType): groupType is string => typeof groupType === "string"
          )
        : [],
    }));
  }

  /**
   * Get a specific group by ID
   */
  async getGroup(groupId: string): Promise<GraphGroup | null> {
    try {
      const response = await this.client
        .api(`/groups/${encodeGraphPathSegment(groupId)}`)
        .select(
          "id,displayName,description,securityEnabled,mailEnabled,mail,groupTypes"
        )
        .get();

      return {
        id: response.id,
        displayName: response.displayName,
        description: response.description,
        securityEnabled: response.securityEnabled,
        mailEnabled: response.mailEnabled,
        mail: response.mail,
        groupTypes: response.groupTypes,
      };
    } catch (error: unknown) {
      if (getStatusCode(error) === 404) {
        return null;
      }
      throw normalizeGraphError(error);
    }
  }

  /**
   * Find a group by display name (exact match)
   */
  async findGroupByName(displayName: string): Promise<GraphGroup | null> {
    const filter = `displayName eq '${escapeODataString(displayName)}'`;

    const response = await this.client
      .api("/groups")
      .filter(filter)
      .select(
        "id,displayName,description,securityEnabled,mailEnabled,mail,groupTypes"
      )
      .top(1)
      .get();

    if (response.value.length === 0) {
      return null;
    }

    const group = response.value[0];
    return {
      id: group.id,
      displayName: group.displayName,
      description: group.description,
      securityEnabled: group.securityEnabled,
      mailEnabled: group.mailEnabled,
      mail: group.mail,
      groupTypes: group.groupTypes,
    };
  }

  async getUserLicenseDetails(userId: string): Promise<GraphLicenseDetail[]> {
    const response = await this.client
      .api(`/users/${encodeGraphPathSegment(userId)}/licenseDetails`)
      .select("skuId,skuPartNumber,servicePlans")
      .get();

    return response.value.map((license: Record<string, unknown>) => ({
      skuId: String(license.skuId ?? ""),
      skuPartNumber:
        typeof license.skuPartNumber === "string"
          ? license.skuPartNumber
          : undefined,
      servicePlans: Array.isArray(license.servicePlans)
        ? license.servicePlans.map((plan) => {
            const servicePlan = plan as Record<string, unknown>;
            return {
              servicePlanId: String(servicePlan.servicePlanId ?? ""),
              servicePlanName:
                typeof servicePlan.servicePlanName === "string"
                  ? servicePlan.servicePlanName
                  : undefined,
              provisioningStatus:
                typeof servicePlan.provisioningStatus === "string"
                  ? servicePlan.provisioningStatus
                  : undefined,
            };
          })
        : [],
    }));
  }

  async listAuthenticationMethods(
    userId: string
  ): Promise<GraphAuthenticationMethod[]> {
    const response = await this.client
      .api(`/users/${encodeGraphPathSegment(userId)}/authentication/methods`)
      .get();

    return response.value.map((method: Record<string, unknown>) => {
      const rawType =
        typeof method["@odata.type"] === "string"
          ? method["@odata.type"]
          : "#microsoft.graph.authenticationMethod";
      return {
        id: String(method.id ?? ""),
        odataType: rawType,
        type: rawType.replace("#microsoft.graph.", ""),
        displayName:
          typeof method.displayName === "string"
            ? method.displayName
            : undefined,
        createdDateTime:
          typeof method.createdDateTime === "string"
            ? method.createdDateTime
            : undefined,
      };
    });
  }

  // --------------------------------------------------------------------------
  // License Operations
  // --------------------------------------------------------------------------

  async listSubscribedSkus(): Promise<GraphSubscribedSku[]> {
    try {
      const response = await this.client
        .api("/subscribedSkus")
        .select("skuId,skuPartNumber,consumedUnits,prepaidUnits")
        .get();

      return response.value.map((sku: Record<string, unknown>) => {
        const prepaid = (sku.prepaidUnits ?? {}) as Record<string, unknown>;
        return {
          skuId: String(sku.skuId ?? ""),
          skuPartNumber: String(sku.skuPartNumber ?? ""),
          consumedUnits:
            typeof sku.consumedUnits === "number" ? sku.consumedUnits : 0,
          prepaidUnits: {
            enabled: typeof prepaid.enabled === "number" ? prepaid.enabled : 0,
            suspended:
              typeof prepaid.suspended === "number" ? prepaid.suspended : 0,
            warning: typeof prepaid.warning === "number" ? prepaid.warning : 0,
          },
        };
      });
    } catch (error) {
      throw normalizeGraphError(error);
    }
  }

  async manageLicense(
    userId: string,
    addSkuIds: string[],
    removeSkuIds: string[]
  ): Promise<void> {
    try {
      await this.client
        .api(`/users/${encodeGraphPathSegment(userId)}/assignLicense`)
        .post({
          addLicenses: addSkuIds.map((skuId) => ({ skuId })),
          removeLicenses: removeSkuIds,
        });
    } catch (error) {
      throw normalizeGraphError(error);
    }
  }

  // --------------------------------------------------------------------------
  // Authentication Method Operations
  // --------------------------------------------------------------------------

  async deleteAuthenticationMethod(
    userId: string,
    methodId: string,
    odataType: string
  ): Promise<void> {
    const PASSWORD_METHOD = "#microsoft.graph.passwordAuthenticationMethod";
    if (odataType === PASSWORD_METHOD) {
      throw new Error("Password authentication method cannot be removed.");
    }

    const METHOD_PATHS: Record<string, string> = {
      "#microsoft.graph.microsoftAuthenticatorAuthenticationMethod":
        "microsoftAuthenticatorMethods",
      "#microsoft.graph.phoneAuthenticationMethod": "phoneMethods",
      "#microsoft.graph.fido2AuthenticationMethod": "fido2Methods",
      "#microsoft.graph.softwareOathAuthenticationMethod":
        "softwareOathMethods",
      "#microsoft.graph.temporaryAccessPassAuthenticationMethod":
        "temporaryAccessPassMethods",
      "#microsoft.graph.windowsHelloForBusinessAuthenticationMethod":
        "windowsHelloForBusinessMethods",
    };

    const subPath = METHOD_PATHS[odataType];
    if (!subPath) {
      throw new Error(`Unsupported authentication method type: ${odataType}`);
    }

    try {
      await this.client
        .api(
          `/users/${encodeGraphPathSegment(userId)}/authentication/${subPath}/${encodeGraphPathSegment(methodId)}`
        )
        .delete();
    } catch (error) {
      throw normalizeGraphError(error);
    }
  }

  // --------------------------------------------------------------------------
  // Session Operations
  // --------------------------------------------------------------------------

  async revokeSignInSessions(userId: string): Promise<void> {
    try {
      await this.client
        .api(`/users/${encodeGraphPathSegment(userId)}/revokeSignInSessions`)
        .post({});
    } catch (error) {
      throw normalizeGraphError(error);
    }
  }

  // --------------------------------------------------------------------------
  // Password Operations
  // --------------------------------------------------------------------------

  async forcePasswordResetNextSignIn(userId: string): Promise<void> {
    try {
      await this.client
        .api(`/users/${encodeGraphPathSegment(userId)}`)
        .patch({ passwordProfile: { forceChangePasswordNextSignIn: true } });
    } catch (error) {
      throw normalizeGraphError(error);
    }
  }

  async resetPassword(
    userId: string,
    temporaryPassword: string
  ): Promise<void> {
    try {
      await this.client.api(`/users/${encodeGraphPathSegment(userId)}`).patch({
        passwordProfile: {
          password: temporaryPassword,
          forceChangePasswordNextSignIn: true,
        },
      });
    } catch (error) {
      throw normalizeGraphError(error);
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a secure temporary password
 */
export function generateTemporaryPassword(length = 16): string {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const special = "!@#$%^&*";
  const all = lowercase + uppercase + numbers + special;

  const pick = (characters: string): string =>
    characters[randomInt(0, characters.length)] ?? characters[0] ?? "";

  let password = "";
  // Ensure at least one of each type
  password += pick(lowercase);
  password += pick(uppercase);
  password += pick(numbers);
  password += pick(special);

  // Fill the rest
  for (let i = password.length; i < length; i++) {
    password += pick(all);
  }

  const characters = password.split("");
  for (let index = characters.length - 1; index > 0; index--) {
    const swapIndex = randomInt(0, index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex] ?? "",
      characters[index] ?? "",
    ];
  }

  return characters.join("");
}

/**
 * Generate UPN from first and last name
 */
export function generateUpn(
  firstName: string,
  lastName: string,
  domain: string
): string {
  const sanitize = (str: string) =>
    str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .replace(/[^a-z0-9]/g, ""); // Remove special chars

  return `${sanitize(firstName)}.${sanitize(lastName)}@${domain}`;
}

/**
 * Get the required security groups for a campus/department combination
 */
export function getRequiredSecurityGroups(
  campusName: string,
  departmentCode: string
): string[] {
  return [`SG-App-Campus-${campusName}`, `SG-App-Dept-${departmentCode}`];
}
