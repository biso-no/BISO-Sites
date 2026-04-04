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

export interface CreateUserResult {
  error?: string;
  groupsAssigned?: string[];
  success: boolean;
  upn?: string;
  userId?: string;
}

export interface BulkCreateUserResult {
  index: number;
  input: CreateUserInput;
  result: CreateUserResult;
}

export interface BulkCreateUsersResponse {
  results: BulkCreateUserResult[];
  totalFailed: number;
  totalRequested: number;
  totalSucceeded: number;
}

export interface AccountTurnoverResult {
  dryRun: boolean;
  error?: string;
  incomingUserUpn: string;
  roleMailboxUpn: string;
  success: boolean;
  webhookResponse?: unknown;
}

export interface BulkAccountTurnoverResponse {
  results: AccountTurnoverResult[];
  totalFailed: number;
  totalRequested: number;
  totalSucceeded: number;
}

// ============================================================================
// Admin Scope Types
// ============================================================================

/**
 * Represents the authorization scope for an admin user
 */
export interface AdminScope {
  /** True if admin can manage any campus (National + OperationsUnit) */
  canManageAnyCampus: boolean;
  /** Whether admin is a campus admin */
  isCampusAdmin: boolean;
  /** Whether admin is a global admin */
  isGlobalAdmin: boolean;
  /** Campus names the admin can manage */
  managedCampusNames: string[];
  /** Department names the admin can manage (empty if campus-level or global) */
  managedDepartmentNames: string[];
  /** User ID of the admin */
  userId: string;
}

// ============================================================================
// M365 Group Types
// ============================================================================

export interface M365Group {
  description?: string;
  displayName: string;
  id: string;
  isSecurityGroup: boolean;
}

export interface M365User {
  department?: string;
  displayName: string;
  id: string;
  mail?: string;
  managerId?: string;
  officeLocation?: string;
  userPrincipalName: string;
}

// ============================================================================
// Campus & Department Selection Types
// ============================================================================

export interface CampusOption {
  id: string;
  name: string;
  officeLocation: string; // Maps to M365 Office location
}

export interface DepartmentOption {
  campusId: string;
  id: string;
  name: string;
  securityGroupName: string; // e.g., "SG-App-Department-OSL-SIVOK"
}

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

export interface UserManagementAuditLog {
  action: UserManagementAuditAction;
  actorEmail?: string;
  actorId: string;
  error?: string;
  groupChanges?: {
    added: string[];
    removed: string[];
  };
  requestedCampusId?: string;
  requestedDepartmentId?: string;
  requestedManagerId?: string;
  success: boolean;
  targetUserIds: string[];
  timestamp: string;
  webhookResponse?: unknown;
}
