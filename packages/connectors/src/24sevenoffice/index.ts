/**
 * 24SevenOffice Connector
 *
 * SOAP API integration for 24SevenOffice CRM.
 * Used to sync membership purchases with customer records.
 */

// Customer sync function
export { syncMembershipTo24SO, hasMembershipProduct } from "./sync";

// Customer management
export { findOrCreateCompany, getCompanyById, getCompaniesByIds, searchCustomerByStudentId, createStudentCustomer } from "./company";

// Category management
export { saveCustomerCategories, assignMembershipCategory, getCustomerCategories, getAllCategories, getMembershipCategories, getCustomerCategoryTree, type CustomerCategoryMapping } from "./categories";

// Products management
export { getProducts, getMembershipProducts } from "./products";

// Invoice management
export { createMembershipInvoice, CAMPUS_DEPARTMENT_IDS, CAMPUS_NAMES } from "./invoice";



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

export type { InvoiceOrder, InvoiceRow } from "./invoice";

