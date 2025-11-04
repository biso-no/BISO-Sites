# Vipps Checkout - Quick Start

## 1️⃣ Add Environment Variables

```bash
# .env.local
VIPPS_CLIENT_ID=your_client_id
VIPPS_CLIENT_SECRET=your_client_secret
VIPPS_MERCHANT_SERIAL_NUMBER=your_msn
VIPPS_SUBSCRIPTION_KEY=your_subscription_key
VIPPS_TEST_MODE=true
VIPPS_CALLBACK_TOKEN=generate_random_uuid_here
APPWRITE_DATABASE_ID=app
APPWRITE_ORDERS_COLLECTION_ID=orders
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## 2️⃣ Add Checkout Button to Cart

```tsx
// app/shop/cart/page.tsx
'use client'
import { initiateVippsCheckout } from '@repo/payment/actions'
import { useTransition } from 'react'
import { Button } from '@repo/ui/components/ui/button'

export default function CartPage() {
  const [isPending, startTransition] = useTransition()
  
  const handleCheckout = () => {
    startTransition(async () => {
      await initiateVippsCheckout({
        userId: 'current_user_id',
        items: [
          { productId: '1', name: 'Product', price: 100, quantity: 1 }
        ],
        subtotal: 100,
        total: 100,
        currency: 'NOK',
      })
    })
  }
  
  return (
    <Button onClick={handleCheckout} disabled={isPending}>
      {isPending ? 'Processing...' : 'Go to Checkout'}
    </Button>
  )
}
```

## 3️⃣ Create Order Success Page

```tsx
// app/shop/order/[orderId]/page.tsx
import { getOrder } from '@repo/payment/actions'

export default async function OrderPage({ 
  params 
}: { 
  params: { orderId: string } 
}) {
  const order = await getOrder(params.orderId)
  
  if (!order) return <div>Order not found</div>
  
  return (
    <div>
      <h1>Order #{order.$id}</h1>
      <p>Status: {order.status}</p>
      <p>Total: {order.total} {order.currency}</p>
    </div>
  )
}
```

## 4️⃣ Test It!

1. Click "Go to Checkout" in cart
2. Complete payment in Vipps test environment
3. Get redirected back to order page
4. See order status updated

## ✅ That's It!

The integration automatically handles:
- ✅ Order creation
- ✅ Vipps session
- ✅ Webhooks
- ✅ Status updates
- ✅ Error handling

## 📖 More Info

- **Full Guide**: [INTEGRATION.md](./INTEGRATION.md)
- **API Reference**: [README.md](./README.md)
- **Implementation Details**: [VIPPS_IMPLEMENTATION_SUMMARY.md](../../VIPPS_IMPLEMENTATION_SUMMARY.md)

