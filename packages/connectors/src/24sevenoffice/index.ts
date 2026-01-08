/**
 * 24SevenOffice Connector
 *
 * SOAP API integration for 24SevenOffice CRM.
 * Used to sync membership purchases with customer records.
 */

// Main sync function
export { syncMembershipTo24SO, hasMembershipProduct } from "./sync";

// Customer management
export { findOrCreateCompany, getCompanyById } from "./company";

// Category management
export { saveCustomerCategories, assignMembershipCategory } from "./categories";

// Authentication (lower-level, usually not needed directly)
export { getValidSession, hasSession } from "./auth";

// Types
export type {
  Company,
  CompanySearchParams,
  CustomerData,
  MembershipSyncResult,
  Credentials,
} from "./types";
