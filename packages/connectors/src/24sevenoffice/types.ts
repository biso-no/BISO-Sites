/**
 * 24SevenOffice SOAP API Types
 *
 * TypeScript interfaces for 24SevenOffice CRM integration.
 */

import type { Models } from "@repo/api";

// ============= Authentication =============

export type Credentials = {
  ApplicationId: string;
  Username: string;
  Password: string;
};

export type LoginResult = {
  LoginResult: string;
};

export type HasSessionResult = {
  HasSessionResult: boolean;
};

export type StoredToken = Models.Row & {
  token: string;
  $createdAt: string;
};

// ============= Company (Customer) =============

export type Address = {
  Address1?: string;
  Address2?: string;
  City?: string;
  PostalCode?: string;
  Country?: string;
};

export type Addresses = {
  Post?: Address;
  Delivery?: Address;
  Visit?: Address;
  Invoice?: Address;
};

export type PhoneNumber = {
  Value?: string;
};

export type PhoneNumbers = {
  Home?: PhoneNumber;
  Fax?: PhoneNumber;
  Mobile?: PhoneNumber;
  Primary?: PhoneNumber;
  Work?: PhoneNumber;
};

export type EmailAddress = {
  Value?: string;
};

export type EmailAddresses = {
  Home?: EmailAddress;
  Invoice?: EmailAddress;
  Primary?: EmailAddress;
  Work?: EmailAddress;
  Alternative?: EmailAddress;
};

export type CompanyType =
  | "None"
  | "Lead"
  | "Consumer"
  | "Business"
  | "Supplier";

export type Company = {
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
};

export type CompanySearchParams = {
  ExternalId?: string;
  CompanyId?: number;
  CompanyIds?: number[];
  CompanyName?: string;
  ChangedAfter?: string;
  CompanyEmail?: string;
  CompanyPhone?: string;
  OrganizationNumber?: string;
};

export type GetCompaniesResult = {
  GetCompaniesResult?: {
    Company?: Company | Company[];
  };
};

export type SaveCompaniesResult = {
  SaveCompaniesResult?: {
    Company?: Company | Company[];
  };
};

// ============= Customer Categories =============

export type KeyValuePair = {
  Key: string;
  Value: string;
};

export type SaveCustomerCategoriesResult = {
  SaveCustomerCategoriesResult?: {
    APIException?: APIException | APIException[];
  };
};

export type GetCustomerCategoriesResult = {
  GetCustomerCategoriesResult?: {
    // API returns category IDs as integers, not names
    int?: number | number[];
    APIException?: APIException | APIException[];
  } | null;
};

export type APIException = {
  Type?: string;
  Message?: string;
  StackTrace?: string;
};

// ============= Sync Results =============

export type MembershipSyncResult = {
  success: boolean;
  companyId?: number;
  companyName?: string;
  categoryAssigned?: string;
  error?: string;
};

export type CustomerData = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  studentId?: string;
  userId: string;
};

// ============= Products API =============

export type Product = {
  Id?: number;
  Name?: string;
  No?: string;
  Price?: number;
  Description?: string;
  CategoryId?: number;
  DateChanged?: string;
  APIException?: APIException;
};

export type ProductSearchParams = {
  Id?: number;
  CategoryId?: number;
  No?: string;
  Name?: string;
  ProductIds?: number[];
};

export type GetProductsResult = {
  GetProductsResult?: {
    Product?: Product | Product[];
  };
};

// ============= Category Definitions API =============

export type CategoryDefinition = {
  Id?: number;
  Name?: string;
  ShowContact?: boolean;
  ShowCompany?: boolean;
};

export type GetCategoriesResult = {
  GetCategoriesResult?: {
    Category?: CategoryDefinition | CategoryDefinition[];
  };
};

// ============= Membership Sync Types =============

export type MembershipProductSyncItem = {
  productId: number;
  productName: string;
  productNo: string;
  categoryId: number | null;
  categoryName: string | null;
  expiryDate: string;
  startDate: string;
  isActive: boolean;
};

export type MembershipProductSyncResult = {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  items: MembershipProductSyncItem[];
};
