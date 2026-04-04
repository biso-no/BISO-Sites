"use server";

import { Query } from "@repo/api/client";
import { createAdminClient } from "@repo/api/server";
import type { Memberships } from "@repo/api/types/appwrite";
import {
  assignMembershipCategory,
  type Company,
  createMembershipInvoice,
  createStudentCustomer,
  searchCustomerByStudentId,
} from "@repo/connectors/24sevenoffice";

// ============= Types =============

export interface StudentSearchResult {
  customer: {
    id: number;
    name: string;
    externalId: string;
  } | null;
  found: boolean;
}

export interface PurchasableMembership {
  category: string | null;
  expiryDate: string;
  id: string;
  name: string;
  price: number;
  productId: string;
}

export interface CreateMemberResult {
  categoryAssigned?: string;
  customerId?: number;
  customerName?: string;
  error?: string;
  invoiceOrderId?: number;
  success: boolean;
}

// ============= Server Actions =============

/**
 * Search for a student in 24SevenOffice CRM by their student ID.
 * This is called with debounce from the frontend.
 */
export async function searchStudentInCRM(
  studentId: string
): Promise<StudentSearchResult> {
  if (!studentId || studentId.trim().length < 3) {
    return { found: false, customer: null };
  }

  try {
    const customer = await searchCustomerByStudentId(studentId);

    if (customer?.Id) {
      return {
        found: true,
        customer: {
          id: customer.Id,
          name: customer.Name || "Unknown",
          externalId: customer.ExternalId || studentId,
        },
      };
    }

    return { found: false, customer: null };
  } catch (error) {
    console.error("[New Member] Failed to search student:", error);
    return { found: false, customer: null };
  }
}

/**
 * Create a new student customer in 24SevenOffice CRM.
 */
async function createStudentInCRM(
  studentId: string,
  firstName: string,
  lastName: string
): Promise<{ success: boolean; customer?: Company; error?: string }> {
  if (!(studentId && firstName && lastName)) {
    return { success: false, error: "Missing required fields" };
  }

  try {
    const customer = await createStudentCustomer(
      studentId,
      firstName,
      lastName
    );
    return { success: true, customer };
  } catch (error) {
    console.error("[New Member] Failed to create student:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get all memberships that are marked as purchasable.
 */
export async function getPurchasableMemberships(): Promise<
  PurchasableMembership[]
> {
  const { db } = await createAdminClient();

  const response = await db.listRows<Memberships>("app", "memberships", [
    Query.equal("canPurchase", true),
    Query.orderDesc("expiryDate"),
  ]);

  return response.rows.map((m) => ({
    id: m.$id,
    name: m.name,
    productId: m.membership_id,
    category: m.category,
    price: m.price,
    expiryDate: m.expiryDate,
  }));
}

/**
 * Complete the membership creation flow:
 * 1. Create customer if new, or use existing
 * 2. Assign the membership category to the customer
 * 3. Create an invoice for the membership
 */
export async function createMembershipForStudent(params: {
  studentId: string;
  existingCustomerId?: number;
  firstName?: string;
  lastName?: string;
  membershipId: string;
  campusId: string;
}): Promise<CreateMemberResult> {
  const {
    studentId,
    existingCustomerId,
    firstName,
    lastName,
    membershipId,
    campusId,
  } = params;

  if (!campusId) {
    return { success: false, error: "Campus is required" };
  }

  try {
    // 1. Get customer ID (existing or create new)
    let customerId: number;
    let customerName: string;

    if (existingCustomerId) {
      customerId = existingCustomerId;
      customerName = `Customer ${existingCustomerId}`;
    } else {
      if (!(firstName && lastName)) {
        return {
          success: false,
          error: "First and last name required for new customer",
        };
      }
      const customer = await createStudentCustomer(
        studentId,
        firstName,
        lastName
      );
      if (!customer.Id) {
        return { success: false, error: "Failed to create customer" };
      }
      customerId = customer.Id;
      customerName = customer.Name || `${firstName} ${lastName}`;
    }

    // 2. Get membership details from Appwrite
    const { db } = await createAdminClient();
    const membership = await db.getRow<Memberships>(
      "app",
      "memberships",
      membershipId
    );

    if (!membership) {
      return { success: false, error: "Membership not found" };
    }

    // 3. Assign category to customer
    let categoryAssigned: string | undefined;
    if (membership.category) {
      await assignMembershipCategory(customerId, membership.category);
      categoryAssigned = membership.category;
    }

    // 4. Create invoice
    const productId = Number.parseInt(membership.membership_id, 10);
    if (Number.isNaN(productId)) {
      return { success: false, error: "Invalid product ID" };
    }

    const invoice = await createMembershipInvoice({
      customerId,
      productId,
      productName: membership.name,
      price: membership.price,
      campusId,
    });

    return {
      success: true,
      customerId,
      customerName,
      invoiceOrderId: invoice.OrderId,
      categoryAssigned,
    };
  } catch (error) {
    console.error("[New Member] Failed to create membership:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
