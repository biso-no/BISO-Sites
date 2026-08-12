/**
 * 24SevenOffice / Finago Connector
 *
 * SOAP API integration for 24SevenOffice CRM.
 * Used to sync membership purchases with customer records.
 *
 * REST API integration (Finago REST API) lives in ./rest.
 */

// Authentication (lower-level, usually not needed directly)
export { getValidSession, hasSession } from "./auth";
// Category management
export {
  assignMembershipCategory,
  buildCustomerCategoryPairs,
  type CustomerCategoryMapping,
  getAllCategories,
  getCustomerCategories,
  getCustomerCategoryTree,
  getMembershipCategories,
  saveCustomerCategories,
} from "./categories";
// Customer management
export {
  createStudentCustomer,
  findOrCreateCompany,
  getCompaniesByIds,
  getCompanyById,
  searchCustomerByStudentId,
} from "./company";
// Department list (SOAP — includes inactive departments)
export { getAllDepartmentsSoap, type SoapDepartment } from "./departments";
export type { InvoiceOrder, InvoiceRow } from "./invoice";
// Invoice management
export {
  CAMPUS_DEPARTMENT_IDS,
  CAMPUS_NAMES,
  createMembershipInvoice,
} from "./invoice";
// Membership product sync (admin)
export {
  isActiveByDate,
  parseExpiryDate,
  parseStartDate,
  previewMembershipSync,
  syncMembershipsFrom24SO,
} from "./membership-sync";
// Membership sync row merge (administrator-owned price/canPurchase)
export type {
  ExistingMembershipRow,
  MembershipSyncItemLike,
} from "./membership-sync-merge";
export { mergeMembershipRow } from "./membership-sync-merge";
// Products management
export { getMembershipProducts, getProducts } from "./products";
// Finago REST API
export {
  type BuildExpenseTransactionParams,
  buildExpenseTransactionInput,
  DEPARTMENT_DIMENSION_TYPE,
  type DimensionElement,
  type ExpenseReceiptLine,
  getDepartments,
  type LedgerAccount,
  listAccounts,
  listTaxes,
  type PostExpenseTransactionParams,
  postExpenseTransaction,
  postShopTransaction,
  type ShopTransactionParams,
  type TaxCode,
  type UploadDocumentResult,
  uploadDocument,
} from "./rest";
// Customer sync function
export { hasMembershipProduct } from "./sync";
// Types
export type {
  CategoryDefinition,
  Company,
  CompanySearchParams,
  Credentials,
  MembershipProductSyncItem,
  MembershipProductSyncResult,
  Product,
} from "./types";
