## `@repo/payment` – Vipps MobilePay Integration

The `@repo/payment` package provides payment processing for BISO Sites. It currently supports **Vipps MobilePay Checkout** with a clean, framework-agnostic core and Next.js-friendly server actions.

For full documentation, see `/docs/packages/payment/overview` in the docs app.

### Features

- ✅ **Vipps Checkout Integration** – full checkout flow from cart to confirmation.
- ✅ **Server Actions** – simple APIs for web and admin apps.
- ✅ **Webhook Handling** – processes Vipps callbacks and updates Appwrite orders.
- ✅ **Type-Safe** – written in TypeScript with clear types.
- ✅ **Race Condition Handling** – coordinates webhooks and return redirects.
- ✅ **Framework-Agnostic Core** – core logic can be reused outside Next.js.
- ✅ **Testable** – pure functions, easy to mock dependencies.

### Package Structure

```text
packages/payment/
├── vipps.ts          # Core Vipps logic (framework-agnostic)
├── actions.ts        # Server actions for Next.js
├── INTEGRATION.md    # Detailed integration guide
├── QUICK_START.md    # Additional usage examples
├── tsconfig.json
└── package.json
```

### Installation

The package is already wired as a workspace dependency. In apps:

```ts
import { initiateVippsCheckout } from '@repo/payment/actions';
```

### Environment Configuration

Configure the required Vipps variables (see `INTEGRATION.md` for full list and meanings):

```bash
VIPPS_CLIENT_ID=your_client_id
VIPPS_CLIENT_SECRET=your_secret
VIPPS_MERCHANT_SERIAL_NUMBER=your_msn
VIPPS_SUBSCRIPTION_KEY=your_sub_key
VIPPS_TEST_MODE=true
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Environment and redirect URLs should match what is documented under `/docs/operations/environment-variables`.

### Quick Start

#### 1. Initiate Checkout (Server Action)

```ts
'use server';

import { initiateVippsCheckout } from '@repo/payment/actions';

export async function handleCheckout({ userId, items }: { userId: string; items: any[] }) {
  await initiateVippsCheckout({
    userId,
    items,
    subtotal: 1000,
    total: 1000,
    currency: 'NOK',
  });
  // User is redirected to Vipps
}
```

#### 2. Handle Webhook Callback

```ts
// app/api/payment/vipps/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@repo/api/server';
import { handleVippsCallback } from '@repo/payment/vipps';

export async function POST(request: NextRequest) {
  const authToken = request.headers.get('authorization');
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  const { db } = await createAdminClient();
  await handleVippsCallback(authToken, sessionId, db);

  return NextResponse.json({ success: true });
}
```

#### 3. Show Order Confirmation

```ts
// app/checkout/confirmation/[orderId]/page.tsx
import { getOrder } from '@repo/payment/actions';

export default async function OrderConfirmation({ params }: { params: { orderId: string } }) {
  const order = await getOrder(params.orderId);
  if (!order) return <div>Order not found</div>;

  return (
    <div>
      <h1>Order Confirmed</h1>
      <p>Status: {order.status}</p>
      <p>Total: {order.total} {order.currency}</p>
    </div>
  );
}
```

### Order States

Typical states used in order workflows:

| State        | Description                                  |
|-------------|----------------------------------------------|
| `pending`   | Order created, payment initiated             |
| `authorized`| User approved, money reserved                |
| `paid`      | Payment captured, money transferred          |
| `cancelled` | User cancelled or payment expired            |
| `failed`    | Technical failure                            |

Exact enums and fields are documented in `INTEGRATION.md` and the `/docs/packages/payment/overview` page.

### Testing

Set `VIPPS_TEST_MODE=true` and follow the testing notes in `INTEGRATION.md`. Use Vipps’ test environment and test cards as described in the Vipps developer portal.

### Further Reading

- Integration & edge cases: `packages/payment/INTEGRATION.md`
- Package docs: `/docs/packages/payment/overview`
- Vipps docs: `https://developer.vippsmobilepay.com/`