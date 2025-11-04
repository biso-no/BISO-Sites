# Vipps Checkout Integration Guide

This guide explains how to integrate Vipps Checkout into your Next.js app.

## Overview

The Vipps integration handles the complete payment flow:

1. **User initiates checkout** → Order created with `PENDING` status
2. **User redirected to Vipps** → User completes payment in Vipps app/web
3. **Webhook updates order** → Order status updated based on payment state
4. **User returns to app** → Order status verified and user shown result

## Environment Variables

Add these to your `.env.local`:

```bash
# Vipps API Credentials
VIPPS_CLIENT_ID=your_client_id
VIPPS_CLIENT_SECRET=your_client_secret
VIPPS_MERCHANT_SERIAL_NUMBER=your_msn
VIPPS_SUBSCRIPTION_KEY=your_subscription_key
VIPPS_TEST_MODE=true # Set to false for production
VIPPS_CALLBACK_TOKEN=your_random_secure_token # Generate a random string

# Database
APPWRITE_DATABASE_ID=app
APPWRITE_ORDERS_COLLECTION_ID=orders

# App URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Integration Steps

### 1. Cart Page - Initiate Checkout

Create a form in your cart page that calls the server action:

```tsx
// app/shop/cart/page.tsx
'use client'

import { initiateVippsCheckout } from '@repo/payment/actions'
import { useTransition } from 'react'
import { Button } from '@repo/ui/components/ui/button'

export default function CartPage() {
  const [isPending, startTransition] = useTransition()
  
  // Your cart state
  const cartItems = [
    { productId: '123', name: 'Product 1', price: 100, quantity: 2 },
    { productId: '456', name: 'Product 2', price: 200, quantity: 1 },
  ]
  
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const discountTotal = 0 // Apply any discounts
  const total = subtotal - discountTotal
  
  const handleCheckout = () => {
    startTransition(async () => {
      await initiateVippsCheckout({
        userId: 'user_123', // Get from session
        items: cartItems,
        subtotal,
        discountTotal,
        total,
        currency: 'NOK',
        campusId: 'campus_123', // Optional
        membershipApplied: false, // Optional
        customerInfo: { // Optional, but recommended for better UX
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+4712345678',
        },
      })
    })
  }
  
  return (
    <div>
      {/* Your cart UI */}
      <div>Total: {total} NOK</div>
      
      <Button 
        onClick={handleCheckout} 
        disabled={isPending || cartItems.length === 0}
      >
        {isPending ? 'Processing...' : 'Go to Checkout'}
      </Button>
    </div>
  )
}
```

### 2. Order Success Page

Create a page to show the order details after successful payment:

```tsx
// app/shop/order/[orderId]/page.tsx
import { getOrderStatus } from '@repo/payment/vipps'
import { notFound } from 'next/navigation'
import { OrderStatus } from '@repo/api/types/appwrite'

interface Props {
  params: { orderId: string }
  searchParams: { success?: string }
}

export default async function OrderPage({ params, searchParams }: Props) {
  const order = await getOrderStatus(params.orderId)
  
  if (!order) {
    notFound()
  }
  
  const isSuccess = searchParams.success === 'true'
  
  return (
    <div className="container mx-auto p-6">
      {isSuccess && order.status === 'paid' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h2 className="text-2xl font-bold text-green-800">Payment Successful! 🎉</h2>
          <p className="text-green-700">Your order has been confirmed.</p>
        </div>
      )}
      
      <h1 className="text-3xl font-bold mb-4">Order #{order.$id}</h1>
      
      <div className="space-y-2">
        <div>
          <strong>Status:</strong> {order.status}
        </div>
        <div>
          <strong>Total:</strong> {order.total} {order.currency}
        </div>
        <div>
          <strong>Date:</strong> {new Date(order.$createdAt).toLocaleDateString()}
        </div>
        
        {order.vipps_receipt_url && (
          <div>
            <a 
              href={order.vipps_receipt_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View Vipps Receipt →
            </a>
          </div>
        )}
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Order Items</h2>
        {order.items_json && JSON.parse(order.items_json).map((item: any) => (
          <div key={item.productId} className="border-b py-2">
            <div className="flex justify-between">
              <span>{item.name} x {item.quantity}</span>
              <span>{item.price * item.quantity} NOK</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 3. Handle Errors in Cart

Add error handling to your cart page:

```tsx
// app/shop/cart/page.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { Alert, AlertDescription } from '@repo/ui/components/ui/alert'

export default function CartPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const cancelled = searchParams.get('cancelled')
  
  return (
    <div>
      {error === 'checkout_failed' && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to create checkout session. Please try again.
          </AlertDescription>
        </Alert>
      )}
      
      {error === 'payment_failed' && (
        <Alert variant="destructive">
          <AlertDescription>
            Payment failed. Please try again or use a different payment method.
          </AlertDescription>
        </Alert>
      )}
      
      {cancelled && (
        <Alert>
          <AlertDescription>
            Payment was cancelled. Your cart items are still here.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Rest of cart UI */}
    </div>
  )
}
```

## Payment States Explained

Your order will go through these states:

| State | Description | User Action | Next Steps |
|-------|-------------|-------------|------------|
| `pending` | Order created, payment initiated | User sees Vipps checkout | Wait for payment |
| `authorized` | User approved payment | Payment reserved | Capture payment or cancel |
| `paid` | Payment captured | Money transferred | Fulfill order |
| `cancelled` | User cancelled or payment expired | No payment | Order can be retried |
| `failed` | Technical failure | No payment | Contact support |

## Webhook Configuration

The webhook endpoint is automatically configured when creating the checkout session:
- **URL**: `{YOUR_APP_URL}/api/payment/vipps/callback`
- **Method**: POST
- **Auth**: Bearer token (from `VIPPS_CALLBACK_TOKEN`)

Vipps will call this endpoint when:
- Payment is authorized
- Payment is captured
- Payment is cancelled
- Payment expires

## Testing

### Test Mode

Set `VIPPS_TEST_MODE=true` to use Vipps test environment.

### Test Cards

Use Vipps test phone numbers:
- **Success**: Any test number from Vipps test documentation
- **Decline**: Specific test numbers that simulate failures

### Local Testing with Webhooks

Since Vipps needs to reach your webhook, you need a public URL:

```bash
# Using ngrok
ngrok http 3000

# Update your .env.local with the ngrok URL
NEXT_PUBLIC_BASE_URL=https://your-ngrok-url.ngrok.io
```

## Error Handling

All functions include comprehensive error handling:

```typescript
try {
  const result = await createCheckoutSession(params)
  // Success - redirect to checkout
} catch (error) {
  // Error - order may be in failed state
  // Handle gracefully and inform user
}
```

## Advanced: Capturing Payments

By default, Vipps uses **reserve and capture** flow:

1. **AUTHORIZED** - Money is reserved (not transferred yet)
2. You ship the product
3. You call capture API to transfer money
4. Status becomes **PAID**

To capture manually (not included in this package yet):

```typescript
// This would require additional implementation
await capturePayment(orderId, amount)
```

## Security Best Practices

1. ✅ **Verify webhook token** - Already implemented
2. ✅ **Create order before checkout** - Prevents orphan orders
3. ✅ **Verify order status on return** - Handles webhook delays
4. ✅ **Use HTTPS in production** - Required by Vipps
5. ✅ **Store sensitive data server-side** - Never expose credentials

## Support

- **Vipps Documentation**: https://developer.vippsmobilepay.com/
- **Test Environment**: https://portal.vippsmobilepay.com/
- **Support**: support@vipps.no

