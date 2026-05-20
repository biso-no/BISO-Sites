/**
 * 24SevenOffice SOAP API Types
 *
 * TypeScript interfaces for 24SevenOffice CRM integration.
 */

import type { Models } from "@repo/api";

// ============= Authentication =============

export interface Credentials {
  ApplicationId: string;
  Password: string;
  Username: string;
}

export interface LoginResult {
  LoginResult: string;
}

export interface HasSessionResult {
  HasSessionResult: boolean;
}

export type StoredToken = Models.Row & {
  token: string;
  $createdAt: string;
};

// ============= Company (Customer) =============

export interface Address {
  Address1?: string;
  Address2?: string;
  City?: string;
  Country?: string;
  PostalCode?: string;
}

export interface Addresses {
  Delivery?: Address;
  Invoice?: Address;
  Post?: Address;
  Visit?: Address;
}

export interface PhoneNumber {
  Value?: string;
}

export interface PhoneNumbers {
  Fax?: PhoneNumber;
  Home?: PhoneNumber;
  Mobile?: PhoneNumber;
  Primary?: PhoneNumber;
  Work?: PhoneNumber;
}

export interface EmailAddress {
  Value?: string;
}

export interface EmailAddresses {
  Alternative?: EmailAddress;
  Home?: EmailAddress;
  Invoice?: EmailAddress;
  Primary?: EmailAddress;
  Work?: EmailAddress;
}

export type CompanyType =
  | "None"
  | "Lead"
  | "Consumer"
  | "Business"
  | "Supplier";

export interface Company {
  Addresses?: Addresses;
  Country?: string;
  CurrencyId?: string;
  DateChanged?: string;
  DateCreated?: string;
  EmailAddresses?: EmailAddresses;
  ExternalId?: string;
  FirstName?: string;
  Id?: number;
  Name?: string;
  NickName?: string;
  Note?: string;
  OrganizationNumber?: string;
  PhoneNumbers?: PhoneNumbers;
  Private?: boolean;
  Status?: number;
  Type?: CompanyType;
  Url?: string;
}

export interface CompanySearchParams {
  ChangedAfter?: string;
  CompanyEmail?: string;
  CompanyId?: number;
  CompanyIds?: number[];
  CompanyName?: string;
  CompanyPhone?: string;
  ExternalId?: string;
  OrganizationNumber?: string;
}

export interface GetCompaniesResult {
  GetCompaniesResult?: {
    Company?: Company | Company[];
  };
}

export interface SaveCompaniesResult {
  SaveCompaniesResult?: {
    Company?: Company | Company[];
  };
}

// ============= Customer Categories =============

export interface KeyValuePair {
  Key: string;
  Value: string;
}

export interface SaveCustomerCategoriesResult {
  SaveCustomerCategoriesResult?: {
    APIException?: APIException | APIException[];
  };
}

export interface GetCustomerCategoriesResult {
  GetCustomerCategoriesResult?: {
    // API returns category IDs as integers, not names
    int?: number | number[];
    APIException?: APIException | APIException[];
  } | null;
}

export interface APIException {
  Message?: string;
  StackTrace?: string;
  Type?: string;
}

// ============= Sync Results =============

export interface MembershipSyncResult {
  categoryAssigned?: string;
  companyId?: number;
  companyName?: string;
  error?: string;
  success: boolean;
}

export interface CustomerData {
  email?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  studentId?: string;
  userId: string;
}

// ============= Products API =============

export interface Product {
  APIException?: APIException;
  CategoryId?: number;
  DateChanged?: string;
  Description?: string;
  Id?: number;
  Name?: string;
  No?: string;
  Price?: number;
}

export interface ProductSearchParams {
  CategoryId?: number;
  Id?: number;
  Name?: string;
  No?: string;
  ProductIds?: number[];
}

export interface GetProductsResult {
  GetProductsResult?: {
    Product?: Product | Product[];
  };
}

// ============= Category Definitions API =============

export interface CategoryDefinition {
  Id?: number;
  Name?: string;
  ShowCompany?: boolean;
  ShowContact?: boolean;
}

export interface GetCategoriesResult {
  GetCategoriesResult?: {
    Category?: CategoryDefinition | CategoryDefinition[];
  };
}

// ============= Membership Sync Types =============

export interface MembershipProductSyncItem {
  categoryId: number | null;
  categoryName: string | null;
  expiryDate: string;
  isActive: boolean;
  productId: number;
  productName: string;
  productNo: string;
  startDate: string;
}

export interface MembershipProductSyncResult {
  created: number;
  errors: string[];
  items: MembershipProductSyncItem[];
  skipped: number;
  success: boolean;
  updated: number;
}
