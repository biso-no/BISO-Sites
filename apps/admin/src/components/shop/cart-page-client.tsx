'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ShoppingCart, ArrowLeft, Trash2, Plus, Minus, Tag, Users, MapPin, CreditCard, Package, Sparkles, AlertCircle } from 'lucide-react'
import { Card } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'
import { Badge } from '@repo/ui/components/ui/badge'
import { Separator } from '@repo/ui/components/ui/separator'
import { ImageWithFallback } from '@repo/ui/components/image'
import { Alert, AlertDescription } from '@repo/ui/components/ui/alert'
import { useCart } from '@/lib/contexts/cart-context'
import { initiateVippsCheckout } from '@repo/payment/actions'
import { Currency } from '@repo/api/types/appwrite'

interface CartPageClientProps {
  isMember?: boolean
  userId?: string | null
}

const categoryColors: Record<string, string> = {
  Merch: 'bg-purple-100 text-purple-700 border-purple-200',
  Trips: 'bg-blue-100 text-blue-700 border-blue-200',
  Lockers: 'bg-green-100 text-green-700 border-green-200',
  Membership: 'bg-orange-100 text-orange-700 border-orange-200',
}

export function CartPageClient({ isMember = false, userId = null }: CartPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const { items, updateQuantity, removeItem, getSubtotal, getRegularSubtotal, getTotalSavings } = useCart()

  const subtotal = getSubtotal(isMember)
  const regularSubtotal = getRegularSubtotal()
  const totalSavings = getTotalSavings(isMember)
  const discountTotal = isMember ? totalSavings : 0

  const hasUnlockableDiscounts = !isMember && items.some(item => item.memberPrice)
  const potentialSavings = !isMember ? regularSubtotal - items.reduce((sum, item) => {
    const price = item.memberPrice || item.regularPrice
    return sum + price * item.quantity
  }, 0) : 0

  // Get error from URL
  const error = searchParams.get('error')
  const cancelled = searchParams.get('cancelled')

  const handleQuantityChange = (itemId: string, change: number) => {
    const item = items.find(i => i.id === itemId)
    if (item) {
      updateQuantity(itemId, item.quantity + change)
    }
  }

  const handleCheckout = () => {
    startTransition(async () => {
      await initiateVippsCheckout({
        userId: userId || 'guest', // TODO: Get from auth session
        items: items.map(item => ({
          productId: item.productId,
          name: item.name,
          price: isMember && item.memberPrice ? item.memberPrice : item.regularPrice,
          quantity: item.quantity,
        })),
        subtotal: regularSubtotal,
        discountTotal: discountTotal || undefined,
        total: subtotal,
        currency: Currency.NOK,
        membershipApplied: isMember,
        memberDiscountPercent: isMember && totalSavings > 0 ? Math.round((totalSavings / regularSubtotal) * 100) : undefined,
        // TODO: Add customer info from user profile
      })
    })
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="relative h-[40vh] overflow-hidden">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1472851294608-062f824d29cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaG9wcGluZyUyMGNhcnR8ZW58MXx8fHwxNzYyMTY1MTQ1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Shopping Cart"
          className="w-full h-full object-cover"
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
              <div className="flex items-center justify-center gap-2 mb-4">
                <ShoppingCart className="w-12 h-12 text-[#3DA9E0]" />
              </div>
              <h1 className="mb-4 text-white text-4xl md:text-5xl font-bold">
                Your Cart
              </h1>
              <p className="text-white/90 text-lg">
                {items.length} {items.length === 1 ? 'item' : 'items'} ready for pickup
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Error Messages */}
        {error === 'checkout_failed' && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to create checkout session. Please try again or contact support if the problem persists.
            </AlertDescription>
          </Alert>
        )}
        
        {error === 'payment_failed' && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Payment failed. Please try again or use a different payment method.
            </AlertDescription>
          </Alert>
        )}
        
        {cancelled === 'true' && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              Payment was cancelled. Your cart items are still here when you&apos;re ready to checkout.
            </AlertDescription>
          </Alert>
        )}

        {items.length === 0 ? (
          // Empty Cart
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <ShoppingCart className="w-24 h-24 text-gray-300 mx-auto mb-6" />
            <h2 className="text-gray-900 mb-4 text-2xl font-bold">Your cart is empty</h2>
            <p className="text-gray-600 mb-8 text-lg">
              Start adding some amazing BISO products to your cart!
            </p>
            <Button
              onClick={() => router.push('/shop')}
              className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white"
            >
              Continue Shopping
            </Button>
          </motion.div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              <AnimatePresence mode="popLayout">
                {items.map((item, index) => {
                  const itemPrice = isMember && item.memberPrice ? item.memberPrice : item.regularPrice
                  const itemTotal = itemPrice * item.quantity
                  const hasDiscount = isMember && item.memberPrice && item.memberPrice < item.regularPrice
                  const savings = hasDiscount ? (item.regularPrice - (item.memberPrice ?? 0)) * item.quantity : 0

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ delay: index * 0.1 }}
                      layout
                    >
                      <Card className="p-6 border-0 shadow-lg">
                        <div className="flex gap-6">
                          {/* Product Image */}
                          <div className="relative w-32 h-32 shrink-0 rounded-lg overflow-hidden">
                            <ImageWithFallback
                              src={item.image || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1080'}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                            <Badge className={`absolute top-2 left-2 ${categoryColors[item.category]}`}>
                              {item.category}
                            </Badge>
                          </div>

                          {/* Product Details */}
                          <div className="grow">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="text-gray-900 mb-1 font-semibold">{item.name}</h3>
                                {item.memberOnly && (
                                  <Badge className="bg-orange-500 text-white border-0 mb-2">
                                    <Users className="w-3 h-3 mr-1" />
                                    Members Only
                                  </Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(item.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>

                            {/* Selected Options */}
                            {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                              <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-500 mb-1">Selected options:</p>
                                {Object.entries(item.selectedOptions).map(([key, value]) => (
                                  <p key={key} className="text-sm text-gray-700">
                                    <strong>{key}:</strong> {value}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* Price and Quantity */}
                            <div className="flex items-center justify-between mt-4">
                              {/* Quantity Control */}
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600">Quantity:</span>
                                <div className="flex items-center gap-2 border border-gray-300 rounded-lg">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleQuantityChange(item.id, -1)}
                                    disabled={item.quantity <= 1}
                                    className="h-8 w-8 p-0 disabled:opacity-50"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </Button>
                                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleQuantityChange(item.id, 1)}
                                    disabled={item.stock !== null && item.quantity >= item.stock}
                                    className="h-8 w-8 p-0 disabled:opacity-50"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                                {item.stock !== null && item.stock <= 10 && (
                                  <span className="text-xs text-orange-600">
                                    Only {item.stock} available
                                  </span>
                                )}
                              </div>

                              {/* Price */}
                              <div className="text-right">
                                {hasDiscount ? (
                                  <div>
                                    <div className="text-gray-400 line-through text-sm">
                                      {item.regularPrice * item.quantity} NOK
                                    </div>
                                    <div className="text-[#3DA9E0] font-bold">
                                      {itemTotal} NOK
                                    </div>
                                    <div className="text-xs text-green-600">
                                      Save {savings} NOK
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-gray-900 font-bold">
                                    {itemTotal} NOK
                                  </div>
                                )}
                                {!isMember && item.memberPrice && item.memberPrice < item.regularPrice && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Members: {item.memberPrice * item.quantity} NOK
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>

            {/* Order Summary */}
            <div className="space-y-6">
              {/* Member Benefits Alert */}
              {hasUnlockableDiscounts && potentialSavings > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Alert className="border-[#3DA9E0] bg-linear-to-br from-[#3DA9E0]/10 to-cyan-50">
                    <Sparkles className="h-4 w-4 text-[#3DA9E0]" />
                    <AlertDescription>
                      <p className="text-sm text-gray-900 mb-2">
                        <strong>Unlock member discounts!</strong>
                      </p>
                      <p className="text-sm text-gray-600 mb-3">
                        You could save {potentialSavings} NOK on this order by becoming a BISO member.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => router.push('/shop?category=Membership')}
                        className="w-full bg-[#3DA9E0] hover:bg-[#3DA9E0]/90 text-white"
                      >
                        Join BISO - From 350 NOK
                      </Button>
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}

              {/* Order Summary Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="p-6 border-0 shadow-lg sticky top-24">
                  <h3 className="text-gray-900 mb-4 text-xl font-bold">Order Summary</h3>

                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal ({items.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
                      <span className="font-medium">{isMember ? subtotal : regularSubtotal} NOK</span>
                    </div>

                    {isMember && totalSavings > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span className="flex items-center gap-1">
                          <Tag className="w-4 h-4" />
                          Member Discount
                        </span>
                        <span className="font-medium">-{totalSavings} NOK</span>
                      </div>
                    )}

                    <div className="flex justify-between text-gray-600">
                      <span>Shipping</span>
                      <span className="text-green-600 font-medium">Free (Campus Pickup)</span>
                    </div>

                    <div className="flex justify-between text-gray-600 text-sm">
                      <span>Tax</span>
                      <span>Included</span>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="flex justify-between mb-6">
                    <span className="text-gray-900 font-bold text-lg">Total</span>
                    <div className="text-right">
                      <div className="text-[#3DA9E0] font-bold text-2xl">{subtotal} NOK</div>
                    </div>
                  </div>

                  {isMember && totalSavings > 0 && (
                    <div className="mb-4 p-3 bg-green-50 rounded-lg text-center">
                      <p className="text-sm text-green-700">
                        🎉 You&apos;re saving <strong>{totalSavings} NOK</strong> with your membership!
                      </p>
                    </div>
                  )}

                  <Button 
                    onClick={handleCheckout}
                    disabled={isPending}
                    className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white mb-3 disabled:opacity-70"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {isPending ? 'Processing...' : 'Proceed to Checkout'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => router.push('/shop')}
                    className="w-full border-[#3DA9E0]/20 text-[#001731] hover:bg-[#3DA9E0]/10"
                  >
                    Continue Shopping
                  </Button>
                </Card>
              </motion.div>

              {/* Pickup Information */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="p-6 border-0 shadow-lg bg-blue-50">
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="mb-2 text-gray-900 font-semibold">Campus Pickup</h4>
                      <p className="text-sm text-gray-700 mb-2">
                        All items will be available for pickup at the BISO office.
                      </p>
                      <div className="text-sm text-gray-600">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-blue-600" />
                          <span>Main Building, Ground Floor</span>
                        </div>
                        <strong>Hours:</strong> Monday-Friday, 10:00-16:00<br />
                        <strong>Pickup:</strong> Within 5 working days of purchase
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

