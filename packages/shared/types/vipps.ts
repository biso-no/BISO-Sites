export enum Currency {
  NOK = "NOK",
}

export type CheckoutSessionParams = {
  userId: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    title?: string; // Add optional fields that might be used
    unit_price?: number;
    product_type?: string;
    category?: string;
  }>;
  subtotal: number;
  discountTotal?: number;
  shippingCost?: number;
  total: number;
  reference: string;
  currency: Currency;
  membershipApplied?: boolean;
  memberDiscountPercent?: number;
  campusId?: string;
  customerInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    streetAddress?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
};

export type VippsCheckoutResponse = {
  checkoutUrl: string;
  orderId: string;
  sessionId: string;
};

export type VippsPaymentState = {
  state: "CREATED" | "AUTHORIZED" | "ABORTED" | "EXPIRED" | "TERMINATED";
  amount?: {
    value: number;
    currency: string;
  };
};
