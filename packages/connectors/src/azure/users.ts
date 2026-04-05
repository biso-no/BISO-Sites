import type { Client } from "@microsoft/microsoft-graph-client";
import { createGraphClient } from "./index";

// ============================================================================
// Types
// ============================================================================

export interface GraphUserCreateInput {
  department?: string;
  displayName: string;
  forceChangePasswordNextSignIn?: boolean;
  mailNickname: string;
  officeLocation?: string;
  password: string;
  userPrincipalName: string;
}

export interface GraphUser {
  department?: string;
  displayName: string;
  id: string;
  jobTitle?: string;
  mail?: string;
  officeLocation?: string;
  userPrincipalName: string;
}

export interface GraphGroup {
  description?: string;
  displayName: string;
  id: string;
  mailEnabled: boolean;
  securityEnabled: boolean;
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
      accountEnabled: true,
      displayName: input.displayName,
      userPrincipalName: input.userPrincipalName,
      mailNickname: input.mailNickname,
      department: input.department,
      officeLocation: input.officeLocation,
      passwordProfile: {
        password: input.password,
        forceChangePasswordNextSignIn:
          input.forceChangePasswordNextSignIn ?? true,
      },
    });

    return {
      id: response.id,
      displayName: response.displayName,
      userPrincipalName: response.userPrincipalName,
      mail: response.mail,
      department: response.department,
      officeLocation: response.officeLocation,
      jobTitle: response.jobTitle,
    };
  }

  /**
   * Update user attributes
   */
  async updateUser(
    userId: string,
    updates: Partial<{
      displayName: string;
      department: string;
      officeLocation: string;
      jobTitle: string;
    }>
  ): Promise<void> {
    await this.client.api(`/users/${userId}`).patch(updates);
  }

  /**
   * Get a user by ID or UPN
   */
  async getUser(userIdOrUpn: string): Promise<GraphUser | null> {
    try {
      const response = await this.client
        .api(`/users/${userIdOrUpn}`)
        .select(
          "id,displayName,userPrincipalName,mail,department,officeLocation,jobTitle"
        )
        .get();

      return {
        id: response.id,
        displayName: response.displayName,
        userPrincipalName: response.userPrincipalName,
        mail: response.mail,
        department: response.department,
        officeLocation: response.officeLocation,
        jobTitle: response.jobTitle,
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Search users by display name or UPN
   */
  async searchUsers(query: string, limit = 20): Promise<GraphUser[]> {
    const filter = `startswith(displayName,'${query}') or startswith(userPrincipalName,'${query}')`;

    const response = await this.client
      .api("/users")
      .filter(filter)
      .select("id,displayName,userPrincipalName,mail,department,officeLocation")
      .top(limit)
      .get();

    return response.value.map((user: any) => ({
      id: user.id,
      displayName: user.displayName,
      userPrincipalName: user.userPrincipalName,
      mail: user.mail,
      department: user.department,
      officeLocation: user.officeLocation,
    }));
  }

  // --------------------------------------------------------------------------
  // Manager Operations
  // --------------------------------------------------------------------------

  /**
   * Set the manager for a user
   */
  async setManager(userId: string, managerId: string): Promise<void> {
    await this.client.api(`/users/${userId}/manager/$ref`).put({
      "@odata.id": `https://graph.microsoft.com/v1.0/users/${managerId}`,
    });
  }

  /**
   * Remove the manager from a user
   */
  async removeManager(userId: string): Promise<void> {
    try {
      await this.client.api(`/users/${userId}/manager/$ref`).delete();
    } catch (error: any) {
      // Ignore 404 - user might not have a manager
      if (error.statusCode !== 404) {
        throw error;
      }
    }
  }

  /**
   * Get the manager of a user
   */
  async getManager(userId: string): Promise<GraphUser | null> {
    try {
      const response = await this.client
        .api(`/users/${userId}/manager`)
        .select("id,displayName,userPrincipalName,mail")
        .get();

      return {
        id: response.id,
        displayName: response.displayName,
        userPrincipalName: response.userPrincipalName,
        mail: response.mail,
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
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
      .api(`/users/${userId}/memberOf`)
      .select("id,displayName,description,securityEnabled,mailEnabled")
      .get();

    return response.value
      .filter((item: any) => item["@odata.type"] === "#microsoft.graph.group")
      .map((group: any) => ({
        id: group.id,
        displayName: group.displayName,
        description: group.description,
        securityEnabled: group.securityEnabled,
        mailEnabled: group.mailEnabled,
      }));
  }

  /**
   * Add a user to a group
   */
  async addUserToGroup(userId: string, groupId: string): Promise<void> {
    try {
      await this.client.api(`/groups/${groupId}/members/$ref`).post({
        "@odata.id": `https://graph.microsoft.com/v1.0/users/${userId}`,
      });
    } catch (error: any) {
      // Ignore 400 with "already exists" - user is already a member
      if (
        error.statusCode === 400 &&
        error.message?.includes("already exist")
      ) {
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
      await this.client
        .api(`/groups/${groupId}/members/${userId}/$ref`)
        .delete();
    } catch (error: any) {
      // Ignore 404 - user might not be in the group
      if (error.statusCode !== 404) {
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
      } catch (error: any) {
        failed.push({
          groupId,
          error: error.message || "Unknown error",
        });
      }
    }

    return { succeeded, failed };
  }

  /**
   * Search for groups by display name
   */
  async searchGroups(query: string, limit = 50): Promise<GraphGroup[]> {
    const filter = `startswith(displayName,'${query}')`;

    const response = await this.client
      .api("/groups")
      .filter(filter)
      .select("id,displayName,description,securityEnabled,mailEnabled")
      .top(limit)
      .get();

    return response.value.map((group: any) => ({
      id: group.id,
      displayName: group.displayName,
      description: group.description,
      securityEnabled: group.securityEnabled,
      mailEnabled: group.mailEnabled,
    }));
  }

  /**
   * Get a specific group by ID
   */
  async getGroup(groupId: string): Promise<GraphGroup | null> {
    try {
      const response = await this.client
        .api(`/groups/${groupId}`)
        .select("id,displayName,description,securityEnabled,mailEnabled")
        .get();

      return {
        id: response.id,
        displayName: response.displayName,
        description: response.description,
        securityEnabled: response.securityEnabled,
        mailEnabled: response.mailEnabled,
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Find a group by display name (exact match)
   */
  async findGroupByName(displayName: string): Promise<GraphGroup | null> {
    const filter = `displayName eq '${displayName}'`;

    const response = await this.client
      .api("/groups")
      .filter(filter)
      .select("id,displayName,description,securityEnabled,mailEnabled")
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
    };
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

  let password = "";
  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
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
