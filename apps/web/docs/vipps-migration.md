# Vipps Integration Migration

## Overview

This document describes the migration from API routes to server actions for Vipps checkout integration using the official Vipps MobilePay SDK.

## Changes Made

### 1. Updated Vipps SDK Configuration (`src/lib/vipps.ts`)
- Uses `@vippsmobilepay/sdk` for type safety
- Configured with environment variables
- Added support for orderId in return URLs

### 2. New Server Actions (`src/app/actions/orders.ts`)
- `createCheckoutSession(data: CheckoutData)` - Creates order and Vipps checkout
- `startCheckout(data: CheckoutData)` - Wrapper that redirects to payment URL
- `getCheckoutStatus(orderId: string)` - Gets order and Vipps status

### 3. Updated Frontend (`src/app/(public)/shop/checkout/[slug]/page.tsx`)
- Now uses server actions instead of API calls
- Better type safety with TypeScript

### 4. API Routes (Kept for Webhooks)
- `src/app/api/checkout/webhook/route.ts` - Handles Vipps webhooks
- `src/app/api/checkout/return/route.ts` - Handles return from Vipps

## Benefits

1. **Type Safety**: Full TypeScript support with Vipps SDK
2. **Better Performance**: Server actions are more efficient than API routes for form submissions
3. **Simplified Code**: Less boilerplate code
4. **Better Error Handling**: Consistent error handling patterns

## Environment Variables Required

```bash
VIPPS_CLIENT_ID=your_client_id
VIPPS_CLIENT_SECRET=your_client_secret
VIPPS_MERCHANT_SERIAL_NUMBER=your_merchant_serial_number
VIPPS_SUBSCRIPTION_KEY=your_subscription_key
NEXT_PUBLIC_BASE_URL=your_base_url
```

## Usage Example

```tsx
import { startCheckout } from '@/app/actions/orders'

// In a server component or server action
await startCheckout({
  slug: 'product-slug',
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+4712345678',
  quantity: 1
})
```

## Testing

The migration maintains the same functionality as before:
1. Creates order in database
2. Creates Vipps checkout session
3. Redirects user to Vipps payment page
4. Handles webhooks for payment status updates
5. Handles return from Vipps
