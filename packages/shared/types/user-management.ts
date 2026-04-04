import { z } from "zod";

// ============================================================================
// User Management Schemas
// ============================================================================

/**
 * Schema for creating a new user in M365 and syncing to Appwrite
 */
export const createUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(64),
  lastName: z.string().min(1, "Last name is required").max(64),
  email: z.string().email().optional(),
  campusId: z.string().min(1, "Campus is required"),
  departmentId: z.string().min(1, "Department is required"),
  managerId: z.string().optional(),
  additionalGroupIds: z.array(z.string()).default([]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Schema for bulk user creation
 */
export const bulkCreateUserRowSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(64),
  lastName: z.string().min(1, "Last name is required").max(64),
  email: z.string().email().optional(),
  campusId: z.string().min(1, "Campus is required"),
  departmentId: z.string().min(1, "Department is required"),
  managerId: z.string().optional(),
  additionalGroupIds: z.array(z.string()).default([]),
});

export const bulkCreateUsersSchema = z.object({
  users: z.array(bulkCreateUserRowSchema).min(1).max(100),
});

export type BulkCreateUsersInput = z.infer<typeof bulkCreateUsersSchema>;

/**
 * Schema for updating a user
 */
export const updateUserSchema = z.object({
  departmentId: z.string().optional(),
  campusId: z.string().optional(),
  managerId: z.string().nullable().optional(),
  additionalGroupIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ============================================================================
// Account Turnover Schemas
// ============================================================================

/**
 * Schema for a single account turnover operation
 */
export const accountTurnoverSchema = z.object({
  roleMailboxUpn: z.string().email("Valid role mailbox UPN required"),
  incomingUserUpn: z.string().email("Valid incoming user UPN required"),
  ensureShared: z.boolean().default(true),
  dryRun: z.boolean().default(false),
});

export type AccountTurnoverInput = z.infer<typeof accountTurnoverSchema>;

/**
 * Schema for bulk account turnover
 */
export const bulkAccountTurnoverSchema = z.object({
  operations: z.array(accountTurnoverSchema).min(1).max(50),
  dryRunAll: z.boolean().default(false),
});

export type BulkAccountTurnoverInput = z.infer<
  typeof bulkAccountTurnoverSchema
>;

// ============================================================================
// Response Types
// ============================================================================

export type CreateUserResult = {
  success: boolean;
  userId?: string;
  upn?: string;
  error?: string;
  groupsAssigned?: string[];
};

export type BulkCreateUserResult = {
  index: number;
  input: CreateUserInput;
  result: CreateUserResult;
};

export type BulkCreateUsersResponse = {
  totalRequested: number;
  totalSucceeded: number;
  totalFailed: number;
  results: BulkCreateUserResult[];
};

export type AccountTurnoverResult = {
  success: boolean;
  roleMailboxUpn: string;
  incomingUserUpn: string;
  dryRun: boolean;
  webhookResponse?: unknown;
  error?: string;
};

export type BulkAccountTurnoverResponse = {
  totalRequested: number;
  totalSucceeded: number;
  totalFailed: number;
  results: AccountTurnoverResult[];
};

// ============================================================================
// Admin Scope Types
// ============================================================================

/**
 * Represents the authorization scope for an admin user
 */
export type AdminScope = {
  /** User ID of the admin */
  userId: string;
  /** True if admin can manage any campus (National + OperationsUnit) */
  canManageAnyCampus: boolean;
  /** Campus names the admin can manage */
  managedCampusNames: string[];
  /** Department names the admin can manage (empty if campus-level or global) */
  managedDepartmentNames: string[];
  /** Whether admin is a global admin */
  isGlobalAdmin: boolean;
  /** Whether admin is a campus admin */
  isCampusAdmin: boolean;
};

// ============================================================================
// M365 Group Types
// ============================================================================

export type M365Group = {
  id: string;
  displayName: string;
  description?: string;
  isSecurityGroup: boolean;
};

export type M365User = {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
  department?: string;
  officeLocation?: string;
  managerId?: string;
};

// ============================================================================
// Campus & Department Selection Types
// ============================================================================

export type CampusOption = {
  id: string;
  name: string;
  officeLocation: string; // Maps to M365 Office location
};

export type DepartmentOption = {
  id: string;
  name: string;
  campusId: string;
  securityGroupName: string; // e.g., "SG-App-Department-OSL-SIVOK"
};

// ============================================================================
// Audit Log Types
// ============================================================================

export type UserManagementAuditAction =
  | "create-user"
  | "bulk-create"
  | "update-user"
  | "sync-groups"
  | "turnover"
  | "bulk-turnover";

export type UserManagementAuditLog = {
  actorId: string;
  actorEmail?: string;
  action: UserManagementAuditAction;
  targetUserIds: string[];
  requestedCampusId?: string;
  requestedDepartmentId?: string;
  requestedManagerId?: string;
  groupChanges?: {
    added: string[];
    removed: string[];
  };
  webhookResponse?: unknown;
  success: boolean;
  error?: string;
  timestamp: string;
};
