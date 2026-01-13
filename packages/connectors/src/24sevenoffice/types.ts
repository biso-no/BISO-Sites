/**
 * 24SevenOffice SOAP API Types
 *
 * TypeScript interfaces for 24SevenOffice CRM integration.
 */

import { Models } from "@repo/api"

// ============= Authentication =============

export interface Credentials {
  ApplicationId: string;
  Username: string;
  Password: string;
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
}

// ============= Company (Customer) =============

export interface Address {
  Address1?: string;
  Address2?: string;
  City?: string;
  PostalCode?: string;
  Country?: string;
}

export interface Addresses {
  Post?: Address;
  Delivery?: Address;
  Visit?: Address;
  Invoice?: Address;
}

export interface PhoneNumber {
  Value?: string;
}

export interface PhoneNumbers {
  Home?: PhoneNumber;
  Fax?: PhoneNumber;
  Mobile?: PhoneNumber;
  Primary?: PhoneNumber;
  Work?: PhoneNumber;
}

export interface EmailAddress {
  Value?: string;
}

export interface EmailAddresses {
  Home?: EmailAddress;
  Invoice?: EmailAddress;
  Primary?: EmailAddress;
  Work?: EmailAddress;
  Alternative?: EmailAddress;
}

export type CompanyType = "None" | "Lead" | "Consumer" | "Business" | "Supplier";

export interface Company {
  Id?: number;
  ExternalId?: string;
  OrganizationNumber?: string;
  Name?: string;
  FirstName?: string;
  NickName?: string;
  Addresses?: Addresses;
  PhoneNumbers?: PhoneNumbers;
  EmailAddresses?: EmailAddresses;
  Url?: string;
  Country?: string;
  Note?: string;
  Type?: CompanyType;
  Status?: number;
  CurrencyId?: string;
  Private?: boolean;
  DateCreated?: string;
  DateChanged?: string;
}

export interface CompanySearchParams {
  ExternalId?: string;
  CompanyId?: number;
  CompanyIds?: number[];
  CompanyName?: string;
  ChangedAfter?: string;
  CompanyEmail?: string;
  CompanyPhone?: string;
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
  Type?: string;
  Message?: string;
  StackTrace?: string;
}

// ============= Sync Results =============

export interface MembershipSyncResult {
  success: boolean;
  companyId?: number;
  companyName?: string;
  categoryAssigned?: string;
  error?: string;
}

export interface CustomerData {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  studentId?: string;
  userId: string;
}

// ============= Products API =============

export interface Product {
  Id?: number;
  Name?: string;
  No?: string;
  Price?: number;
  Description?: string;
  CategoryId?: number;
  DateChanged?: string;
  APIException?: APIException;
}

export interface ProductSearchParams {
  Id?: number;
  CategoryId?: number;
  No?: string;
  Name?: string;
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
  ShowContact?: boolean;
  ShowCompany?: boolean;
}

export interface GetCategoriesResult {
  GetCategoriesResult?: {
    Category?: CategoryDefinition | CategoryDefinition[];
  };
}

// ============= Membership Sync Types =============

export interface MembershipProductSyncItem {
  productId: number;
  productName: string;
  productNo: string;
  categoryId: number | null;
  categoryName: string | null;
  expiryDate: string;
  startDate: string;
  isActive: boolean;
}

export interface MembershipProductSyncResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  items: MembershipProductSyncItem[];
}

