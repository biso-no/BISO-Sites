import { type Orders, OrdersStatus } from "@repo/api/types/appwrite";
import type { CheckoutSessionParams, VippsPaymentState } from "../types/vipps";

export interface VippsSessionData {
  payment?: {
    aggregate?: {
      authorizedAmount?: {
        value?: number | string | null;
      };
      capturedAmount?: {
        value?: number | null;
      };
      receipt?: {
        url?: string | null;
      };
    };
  };
}

export function buildPrefillCustomer(
  info?: CheckoutSessionParams["customerInfo"]
): Record<string, string> | null {
  if (!info) {
    return null;
  }

  const prefill: Record<string, string> = {};

  if (info.firstName) {
    prefill.firstName = info.firstName;
  }
  if (info.lastName) {
    prefill.lastName = info.lastName;
  }
  if (info.email) {
    prefill.email = info.email;
  }
  if (info.phone) {
    prefill.phoneNumber = info.phone;
  }
  if (info.streetAddress) {
    prefill.streetAddress = info.streetAddress;
  }
  if (info.city) {
    prefill.city = info.city;
  }
  if (info.postalCode) {
    prefill.postalCode = info.postalCode;
  }
  if (info.country) {
    prefill.country = info.country;
  }

  return Object.keys(prefill).length > 0 ? prefill : null;
}

export function determineStatusFromPaymentState(
  paymentState: VippsPaymentState,
  sessionData: VippsSessionData
): { status: OrdersStatus; updateData: Partial<Orders> } {
  const updateData: Partial<Orders> = {};
  let newStatus: OrdersStatus;

  switch (paymentState.state) {
    case "CREATED":
      newStatus = OrdersStatus.PENDING;
      break;
    case "AUTHORIZED":
      newStatus = OrdersStatus.AUTHORIZED;
      updateData.payment_intent_id =
        sessionData.payment?.aggregate?.authorizedAmount?.value?.toString() ||
        null;
      break;
    case "ABORTED":
      newStatus = OrdersStatus.CANCELLED;
      break;
    case "EXPIRED":
      newStatus = OrdersStatus.CANCELLED;
      break;
    case "TERMINATED":
      newStatus = OrdersStatus.CANCELLED;
      break;
    default:
      newStatus = OrdersStatus.PENDING;
  }

  const capturedAmount = sessionData.payment?.aggregate?.capturedAmount?.value;
  if (typeof capturedAmount === "number" && capturedAmount > 0) {
    newStatus = OrdersStatus.PAID;
    updateData.payment_receipt_url =
      sessionData.payment?.aggregate?.receipt?.url || null;
  }

  return { status: newStatus, updateData };
}
