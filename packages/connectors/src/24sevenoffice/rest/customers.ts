/**
 * Finago REST API — the customer a reimbursement is paid to.
 *
 * A reimbursement's supplier-debt line (2400) carries the submitter's customer
 * through the Customer dimension, so the debt sits on that person's ledger and
 * the payout reaches them. The customer is found by email and created when
 * there is none. Records named "(Student) Lastname, Firstname" belong to
 * membership purchases and are never used for reimbursements.
 */

import { finago } from "./client";
import type { components } from "./schema";

/** Dimension type that links a transaction line to a customer. */
export const CUSTOMER_DIMENSION_TYPE = 5;

const MEMBERSHIP_NAME_PREFIX = "(Student)";
const MEMBERSHIP_NAME = /^\(Student\)\s*([^,]+),\s*(.+)$/;
const WHITESPACE = /\s+/;
const IBAN_START = /^[A-Z]{2}\d{2}/;
const NOT_ACCOUNT_CHARACTER = /[^A-Z0-9]/g;
const CUSTOMER_SEARCH_LIMIT = 100;

export interface FinagoCustomer {
  emails: string[];
  id: number;
  name: string;
}

export type BankAccountType = "bban" | "iban" | "bankgiro" | "plusgiro";

export interface FinagoBankAccount {
  isDefault: boolean;
  number: string;
  type: BankAccountType;
}

/** What a booking did to the customer's bank accounts. */
export type BankAccountChange = "added" | "made_default" | "unchanged";

/** The REST calls the customer lookup needs, injectable for tests. */
export interface CustomerApi {
  addBankAccount(
    customerId: number,
    account: { isDefault: boolean; number: string; type: "bban" | "iban" }
  ): Promise<void>;
  createPersonCustomer(person: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<number>;
  findCustomersByEmail(email: string): Promise<FinagoCustomer[]>;
  listBankAccounts(customerId: number): Promise<FinagoBankAccount[]>;
  /** Makes an existing account the default. Finago clears the old default. */
  makeBankAccountDefault(
    customerId: number,
    account: { number: string; type: BankAccountType }
  ): Promise<void>;
}

export interface ReimbursementCustomer {
  bankAccountChange: BankAccountChange;
  created: boolean;
  customerId: number;
}

/** Whether a customer record is a membership one, reserved for memberships. */
export function isMembershipCustomer(name: string): boolean {
  return name.trim().startsWith(MEMBERSHIP_NAME_PREFIX);
}

/**
 * The person's name as a reimbursement customer. A BI account name such as
 * "(Student) Heien, Markus" becomes Markus Heien. Any other name keeps its
 * order, with the last word as the last name.
 */
export function payeeName(raw: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = raw.trim();
  const membership = MEMBERSHIP_NAME.exec(trimmed);
  if (membership) {
    return {
      firstName: membership[2].trim(),
      lastName: membership[1].trim(),
    };
  }
  const words = trimmed.split(WHITESPACE).filter(Boolean);
  if (words.length <= 1) {
    return { firstName: words[0] ?? "", lastName: "" };
  }
  return {
    firstName: words.slice(0, -1).join(" "),
    lastName: words.at(-1) ?? "",
  };
}

/** A bank account as Finago stores it: uppercase letters and digits only. */
export function normalizeBankAccount(raw: string): string {
  return raw.toUpperCase().replace(NOT_ACCOUNT_CHARACTER, "");
}

/**
 * Finds the reimbursement customer for a person by email, or creates one, and
 * makes sure the bank account they gave is on it. Several matches use the
 * oldest (lowest number).
 *
 * The bank account from the person's profile is what they're paid to, so it is
 * made the customer's default: added as the default when missing, switched to
 * default when it's there but another one is. Finago clears the old default
 * itself, and keeps the other accounts.
 */
export async function resolveReimbursementCustomer(
  params: { bankAccount: string; email: string; name: string },
  api: CustomerApi = restCustomerApi
): Promise<ReimbursementCustomer> {
  const email = params.email.trim().toLowerCase();
  if (!email) {
    throw new Error(
      "The submitter has no email address, so no Finago customer can be found or created."
    );
  }
  const bankAccount = normalizeBankAccount(params.bankAccount);
  if (!bankAccount) {
    throw new Error(
      "The reimbursement has no bank account, so the customer can't be paid."
    );
  }

  const matches = (await api.findCustomersByEmail(email))
    .filter((customer) => !isMembershipCustomer(customer.name))
    .filter((customer) => customer.emails.includes(email))
    .sort((a, b) => a.id - b.id);

  let customerId = matches[0]?.id;
  let created = false;
  if (customerId === undefined) {
    const { firstName, lastName } = payeeName(params.name);
    if (!firstName) {
      throw new Error(
        "The submitter has no name, so no Finago customer can be created."
      );
    }
    customerId = await api.createPersonCustomer({ email, firstName, lastName });
    created = true;
  }

  const accounts = await api.listBankAccounts(customerId);
  const existing = accounts.find(
    (account) => normalizeBankAccount(account.number) === bankAccount
  );
  let bankAccountChange: BankAccountChange = "unchanged";
  if (!existing) {
    await api.addBankAccount(customerId, {
      isDefault: true,
      number: bankAccount,
      type: IBAN_START.test(bankAccount) ? "iban" : "bban",
    });
    bankAccountChange = "added";
  } else if (!existing.isDefault) {
    // The stored number, as Finago keys the account by it.
    await api.makeBankAccountDefault(customerId, {
      number: existing.number,
      type: existing.type,
    });
    bankAccountChange = "made_default";
  }

  return { bankAccountChange, created, customerId };
}

function lowerEmails(
  email: { billing?: string | null; contact?: string | null } | undefined
): string[] {
  return [email?.contact, email?.billing]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim().toLowerCase());
}

function apiError(action: string, error: unknown): Error {
  return new Error(`[Finago] Could not ${action}: ${JSON.stringify(error)}`);
}

export const restCustomerApi: CustomerApi = {
  async findCustomersByEmail(email) {
    const { data, error } = await finago.GET("/customers", {
      params: {
        header: { Authorization: "" },
        query: { email, limit: CUSTOMER_SEARCH_LIMIT },
      },
    });
    if (error || !data) {
      throw apiError("search customers by email", error);
    }
    return data.map((customer) => ({
      emails: lowerEmails(customer.email),
      id: Number(customer.id),
      name: customer.name ?? "",
    }));
  },

  async createPersonCustomer({ email, firstName, lastName }) {
    // The generator adds a string `isCompany` discriminator on top of the
    // boolean one, which makes the request type impossible to satisfy.
    const body = {
      email: { contact: email },
      isCompany: false,
      person: { firstName, lastName },
    } as unknown as components["schemas"]["CustomerPostRequest"];
    const { data, error } = await finago.POST("/customers", {
      body,
      params: { header: { Authorization: "" } },
    });
    if (error || data?.id === undefined || data.id === null) {
      throw apiError("create the customer", error);
    }
    console.log(`[Finago] Created reimbursement customer ${data.id}`);
    return Number(data.id);
  },

  async listBankAccounts(customerId) {
    const { data, error } = await finago.GET(
      "/customers/{customerId}/bankaccounts",
      {
        params: {
          header: { Authorization: "" },
          path: { customerId: String(customerId) },
        },
      }
    );
    if (error || !data) {
      throw apiError(`read the bank accounts of customer ${customerId}`, error);
    }
    return data.map((account) => ({
      isDefault: Boolean(account.isDefault),
      number: account.number,
      type: account.type,
    }));
  },

  async makeBankAccountDefault(customerId, account) {
    const { error } = await finago.PATCH(
      "/customers/{customerId}/bankaccounts/{accountNumber}",
      {
        body: { isDefault: true, number: account.number, type: account.type },
        params: {
          header: { Authorization: "" },
          path: {
            accountNumber: account.number,
            customerId: String(customerId),
          },
        },
      }
    );
    if (error) {
      throw apiError(
        `make a bank account the default for customer ${customerId}`,
        error
      );
    }
  },

  async addBankAccount(customerId, account) {
    const { error } = await finago.POST(
      "/customers/{customerId}/bankaccounts",
      {
        body: account,
        params: {
          header: { Authorization: "" },
          path: { customerId: String(customerId) },
        },
      }
    );
    if (error) {
      throw apiError(`add a bank account to customer ${customerId}`, error);
    }
  },
};
