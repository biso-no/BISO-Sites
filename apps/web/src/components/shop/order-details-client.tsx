'use client'

import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Clock, Package, Receipt, ArrowLeft, ExternalLink, MapPin } from 'lucide-react'
import { Card } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'
import { Badge } from '@repo/ui/components/ui/badge'
import { Separator } from '@repo/ui/components/ui/separator'
import { ImageWithFallback } from '@repo/ui/components/image'
import type { Orders } from '@repo/api/types/appwrite'
import { format } from 'date-fns'

interface OrderDetailsClientProps {
  order: Orders
  isSuccess: boolean
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    label: 'Pending',
    description: 'Awaiting payment confirmation',
  },
  authorized: {
    icon: Clock,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    label: 'Authorized',
    description: 'Payment authorized, processing order',
  },
  paid: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    label: 'Paid',
    description: 'Payment successful',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    label: 'Cancelled',
    description: 'Order cancelled',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'Failed',
    description: 'Payment failed',
  },
  refunded: {
    icon: XCircle,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    label: 'Refunded',
    description: 'Payment refunded',
  },
}

export function OrderDetailsClient({ order, isSuccess }: OrderDetailsClientProps) {
  const router = useRouter()
  const config = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending
  const StatusIcon = config.icon

  const items = order.items_json ? JSON.parse(order.items_json) : []
  const orderDate = format(new Date(order.$createdAt), 'MMMM d, yyyy \'at\' HH:mm')

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="relative h-[40vh] overflow-hidden">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=1080"
          alt="Order Confirmation"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <motion.button
              onClick={() => router.push('/shop')}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-8 left-8 flex items-center gap-2 text-white hover:text-[#3DA9E0] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Shop
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <StatusIcon className={`w-20 h-20 mx-auto mb-4 ${config.color}`} />
              <h1 className="mb-4 text-white text-4xl md:text-5xl font-bold">
                {isSuccess && order.status === 'paid' ? 'Order Confirmed!' : 'Order Details'}
              </h1>
              <p className="text-white/90 text-lg">
                Order #{order.$id.slice(-8).toUpperCase()}
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Success Message */}
        {isSuccess && order.status === 'paid' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className={`p-6 mb-8 ${config.bg} ${config.border} border-2`}>
              <div className="flex items-start gap-4">
                <CheckCircle2 className="w-8 h-8 text-green-600 shrink-0" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You for Your Purchase!</h2>
                  <p className="text-gray-700 mb-4">
                    Your payment has been confirmed and your order is being processed. 
                    You&apos;ll receive a confirmation email shortly with pickup details.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {order.vipps_receipt_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(order.vipps_receipt_url!, '_blank')}
                        className="border-green-300 text-green-700 hover:bg-green-100"
                      >
                        <Receipt className="w-4 h-4 mr-2" />
                        View Vipps Receipt
                        <ExternalLink className="w-3 h-3 ml-2" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Failed/Cancelled Message */}
        {(order.status === 'failed' || order.status === 'cancelled') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className={`p-6 mb-8 ${config.bg} ${config.border} border-2`}>
              <div className="flex items-start gap-4">
                <XCircle className={`w-8 h-8 ${config.color} shrink-0`} />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {order.status === 'cancelled' ? 'Order Cancelled' : 'Payment Failed'}
                  </h2>
                  <p className="text-gray-700 mb-4">
                    {order.status === 'cancelled' 
                      ? 'This order was cancelled. Your items are still in your cart if you\'d like to try again.'
                      : 'The payment for this order failed. Please try again or contact support if the problem persists.'}
                  </p>
                  <Button
                    onClick={() => router.push('/shop/cart')}
                    className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white"
                  >
                    Return to Cart
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        <div className="grid md:grid-cols-3 gap-8">
          {/* Order Information */}
          <div className="md:col-span-2 space-y-8">
            {/* Order Status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-6 border-0 shadow-lg">
                <h2 className="text-gray-900 mb-4 text-xl font-bold">Order Status</h2>
                <div className="flex items-center gap-3 mb-4">
                  <Badge className={`${config.bg} ${config.color} border-0 px-4 py-2 text-base`}>
                    {config.label}
                  </Badge>
                  <span className="text-gray-600">{config.description}</span>
                </div>
                <div className="text-sm text-gray-600">
                  <div><strong>Order Date:</strong> {orderDate}</div>
                  {order.vipps_order_id && (
                    <div className="mt-2"><strong>Vipps Order ID:</strong> {order.vipps_order_id}</div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Order Items */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-6 border-0 shadow-lg">
                <h2 className="text-gray-900 mb-6 text-xl font-bold">Order Items</h2>
                <div className="space-y-4">
                  {items.map((item: any, index: number) => (
                    <div key={index} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                        <div className="text-sm text-gray-600 mt-1">
                          Quantity: {item.quantity}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          {(item.price * item.quantity).toFixed(2)} {order.currency}
                        </div>
                        <div className="text-sm text-gray-600">
                          {item.price.toFixed(2)} {order.currency} each
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-6" />

                <div className="space-y-2">
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal</span>
                    <span>{order.subtotal.toFixed(2)} {order.currency}</span>
                  </div>
                  {order.discount_total && order.discount_total > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{order.discount_total.toFixed(2)} {order.currency}</span>
                    </div>
                  )}
                  {order.membership_applied && (
                    <div className="text-sm text-[#3DA9E0]">
                      ✓ Member discount applied ({order.member_discount_percent || 0}%)
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Shipping</span>
                    <span className="text-green-600">Free (Campus Pickup)</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-xl font-bold text-gray-900">
                    <span>Total</span>
                    <span>{order.total.toFixed(2)} {order.currency}</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer Information */}
            {(order.buyer_name || order.buyer_email || order.buyer_phone) && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="p-6 border-0 shadow-lg">
                  <h3 className="font-bold text-gray-900 mb-4">Customer Information</h3>
                  <div className="space-y-2 text-sm">
                    {order.buyer_name && (
                      <div>
                        <strong>Name:</strong> {order.buyer_name}
                      </div>
                    )}
                    {order.buyer_email && (
                      <div>
                        <strong>Email:</strong> {order.buyer_email}
                      </div>
                    )}
                    {order.buyer_phone && (
                      <div>
                        <strong>Phone:</strong> {order.buyer_phone}
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Pickup Information */}
            {order.status === 'paid' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="p-6 border-0 shadow-lg bg-blue-50">
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="mb-2 text-gray-900 font-semibold">Pickup Details</h4>
                      <p className="text-sm text-gray-700 mb-2">
                        Your order will be available for pickup at the BISO office.
                      </p>
                      <div className="text-sm text-gray-600">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-blue-600" />
                          <span>Main Building, Ground Floor</span>
                        </div>
                        <strong>Hours:</strong> Monday-Friday, 10:00-16:00<br />
                        <strong>Pickup:</strong> Within 5 working days
                      </div>
                      <p className="text-xs text-gray-500 mt-3">
                        You&apos;ll receive an email when your order is ready for pickup.
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="space-y-3">
                <Button
                  onClick={() => router.push('/shop')}
                  className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white"
                >
                  Continue Shopping
                </Button>
                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  className="w-full border-[#3DA9E0]/20 text-[#001731] hover:bg-[#3DA9E0]/10"
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Print Order
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

