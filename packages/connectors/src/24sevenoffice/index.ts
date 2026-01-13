/**
 * 24SevenOffice Connector
 *
 * SOAP API integration for 24SevenOffice CRM.
 * Used to sync membership purchases with customer records.
 */

// Customer sync function
export { syncMembershipTo24SO, hasMembershipProduct } from "./sync";

// Customer management
export { findOrCreateCompany, getCompanyById } from "./company";

// Category management
export { saveCustomerCategories, assignMembershipCategory, getCustomerCategories, getAllCategories } from "./categories";

// Products management
export { getProducts, getMembershipProducts } from "./products";

// Membership product sync (admin)
export { syncMembershipsFrom24SO, previewMembershipSync, parseExpiryDate, parseStartDate, isActiveByDate } from "./membership-sync";

// Authentication (lower-level, usually not needed directly)
export { getValidSession, hasSession } from "./auth";

// Types
export type {
  Company,
  CompanySearchParams,
  CustomerData,
  MembershipSyncResult,
  Credentials,
  Product,
  CategoryDefinition,
  MembershipProductSyncItem,
  MembershipProductSyncResult,
} from "./types";
