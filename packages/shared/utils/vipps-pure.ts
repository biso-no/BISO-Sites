import { OrderStatus, type Orders } from "@repo/api/types/appwrite";
import type { CheckoutSessionParams, VippsPaymentState } from "../types/vipps";

interface VippsSessionData {
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
): { status: OrderStatus; updateData: Partial<Orders> } {
  const updateData: Partial<Orders> = {};
  let newStatus: OrderStatus;

  switch (paymentState.state) {
    case "CREATED":
      newStatus = OrderStatus.PENDING;
      break;
    case "AUTHORIZED":
      newStatus = OrderStatus.AUTHORIZED;
      updateData.payment_intent_id =
        sessionData.payment?.aggregate?.authorizedAmount?.value?.toString() ||
        null;
      break;
    case "ABORTED":
      newStatus = OrderStatus.CANCELLED;
      break;
    case "EXPIRED":
      newStatus = OrderStatus.CANCELLED;
      break;
    case "TERMINATED":
      newStatus = OrderStatus.CANCELLED;
      break;
    default:
      newStatus = OrderStatus.PENDING;
  }

  const capturedAmount = sessionData.payment?.aggregate?.capturedAmount?.value;
  if (typeof capturedAmount === "number" && capturedAmount > 0) {
    newStatus = OrderStatus.PAID;
    updateData.payment_receipt_url =
      sessionData.payment?.aggregate?.receipt?.url || null;
  }

  return { status: newStatus, updateData };
}
