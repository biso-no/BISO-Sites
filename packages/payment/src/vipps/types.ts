export enum Currency {
  NOK = "NOK",
}

export interface CheckoutSessionParams {
  campusId?: string;
  currency: Currency;
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
  discountTotal?: number;
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
  memberDiscountPercent?: number;
  membershipApplied?: boolean;
  reference: string;
  shippingCost?: number;
  subtotal: number;
  total: number;
  userId: string;
}
