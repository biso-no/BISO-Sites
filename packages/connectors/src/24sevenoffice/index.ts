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
// Department list (SOAP — includes inactive departments)
export { getAllDepartmentsSoap, type SoapDepartment } from "./departments";
// Category management
export {
  assignMembershipCategory,
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
// Products management
export { getMembershipProducts, getProducts } from "./products";
// Finago REST API
export {
  DEPARTMENT_DIMENSION_TYPE,
  type DimensionElement,
  getDepartments,
  postShopTransaction,
  type ShopTransactionParams,
} from "./rest";
// Customer sync function
export { hasMembershipProduct, syncMembershipTo24SO } from "./sync";
// Types
export type {
  CategoryDefinition,
  Company,
  CompanySearchParams,
  Credentials,
  CustomerData,
  MembershipProductSyncItem,
  MembershipProductSyncResult,
  MembershipSyncResult,
  Product,
} from "./types";
