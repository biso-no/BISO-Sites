'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { ArrowLeft, ShoppingCart, Tag, Users, Package, AlertCircle, CheckCircle2, MapPin } from 'lucide-react'
import { Card } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'
import { Badge } from '@repo/ui/components/ui/badge'
import { Separator } from '@repo/ui/components/ui/separator'
import { Label } from '@repo/ui/components/ui/label'
import { Input } from '@repo/ui/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select'
import { ImageWithFallback } from '@repo/ui/components/image'
import { Alert, AlertDescription } from '@repo/ui/components/ui/alert'
import type { ContentTranslations, WebshopProducts } from '@repo/api/types/appwrite'
import { parseProductMetadata, formatPrice, getDisplayPrice, calculateSavings, type ProductOption } from '@/lib/types/webshop'
import { useCart } from '@/lib/contexts/cart-context'
import { getAvailableStock, createOrUpdateReservation } from '@/app/actions/cart-reservations'
import { validatePurchaseLimits } from '@/app/actions/purchase-limits'
import { toast } from 'sonner'

interface ProductDetailsClientProps {
  product: WebshopProducts
  isMember?: boolean
  userId?: string | null
}

const categoryColors: Record<string, string> = {
  Merch: 'bg-purple-100 text-purple-700 border-purple-200',
  Trips: 'bg-blue-100 text-blue-700 border-blue-200',
  Lockers: 'bg-green-100 text-green-700 border-green-200',
  Membership: 'bg-orange-100 text-orange-700 border-orange-200',
}

export function ProductDetailsClient({ product, isMember = false, userId = null }: ProductDetailsClientProps) {
  const router = useRouter()
  const { addItem } = useCart()
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [addedToCart, setAddedToCart] = useState(false)
  const [availableStock, setAvailableStock] = useState<number | null>(null)
  const [isLoadingStock, setIsLoadingStock] = useState(false)

  const metadata = parseProductMetadata(product.metadata)
  const productOptions = (metadata.product_options as ProductOption[]) || []
  
  const displayPrice = getDisplayPrice(product.regular_price, product.member_price, isMember)
  const hasDiscount = isMember && product.member_price && product.member_price < product.regular_price
  const savings = calculateSavings(product.regular_price, product.member_price)
  
  const imageUrl = product.image || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1080'

  // Load available stock on mount
  useEffect(() => {
    async function loadAvailableStock() {
      if (product.stock === null || product.stock === undefined) {
        setAvailableStock(null) // Infinite stock
        return
      }
      
      setIsLoadingStock(true)
      const available = await getAvailableStock(product.$id)
      setAvailableStock(available)
      setIsLoadingStock(false)
    }
    
    loadAvailableStock()
  }, [product.$id, product.stock])

  const handleAddToCart = async () => {
    // Validate required options
    const newErrors: Record<string, boolean> = {}
    
    productOptions.forEach((option, index) => {
      if (option.required && !selectedOptions[`option-${index}`]) {
        newErrors[`option-${index}`] = true
      }
    })

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const quantity = 1 // Adding 1 item at a time

    // Check available stock (considering reservations)
    if (product.stock !== null && product.stock !== undefined) {
      const currentAvailable = await getAvailableStock(product.$id)
      
      if (currentAvailable < quantity) {
        toast.error(
          currentAvailable === 0 
            ? 'This item is out of stock' 
            : `Only ${currentAvailable} available (others reserved in carts)`
        )
        setAvailableStock(currentAvailable)
        return
      }
    }

    // Validate purchase limits (userId handled by session)
    const limitCheck = await validatePurchaseLimits(
      product.$id,
      userId || 'guest', // TODO: Get from session when available
      quantity,
      metadata
    )

    if (!limitCheck.allowed) {
      toast.error(limitCheck.reason || 'Purchase limit exceeded')
      return
    }

    // Convert indexed options to named options
    const namedOptions: Record<string, string> = {}
    productOptions.forEach((option, index) => {
      const value = selectedOptions[`option-${index}`]
      if (value) {
        namedOptions[option.label] = value
      }
    })

    // Create reservation for this stock
    if (product.stock !== null && product.stock !== undefined) {
      const reservationResult = await createOrUpdateReservation(
        product.$id,
        quantity
      )

      if (!reservationResult.success) {
        toast.error('Failed to reserve stock. Please try again.')
        return
      }

      // Update available stock display
      const newAvailable = await getAvailableStock(product.$id)
      setAvailableStock(newAvailable)
    }

    // Add to cart
    addItem({
      contentId: product.$id,
      productId: product.$id,
      slug: product.slug,
      name: product.translation_refs[0]?.title ?? '',
      image: product.image,
      category: product.category,
      regularPrice: product.regular_price,
      memberPrice: product.member_price,
      memberOnly: product.member_only,
      stock: product.stock,
      selectedOptions: Object.keys(namedOptions).length > 0 ? namedOptions : undefined,
      metadata: {
        max_per_user: typeof metadata.max_per_user === 'number' ? metadata.max_per_user : undefined,
        max_per_order: typeof metadata.max_per_order === 'number' ? metadata.max_per_order : undefined,
        sku: typeof metadata.sku === 'string' ? metadata.sku : undefined,
      },
    })

    setAddedToCart(true)
    toast.success('Added to cart')
    setTimeout(() => setAddedToCart(false), 3000)
  }

  const handleOptionChange = (optionIndex: number, value: string) => {
    setSelectedOptions({
      ...selectedOptions,
      [`option-${optionIndex}`]: value,
    })
    
    // Clear error for this option
    if (errors[`option-${optionIndex}`]) {
      const newErrors = { ...errors }
      delete newErrors[`option-${optionIndex}`]
      setErrors(newErrors)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="relative h-[60vh] overflow-hidden">
        <ImageWithFallback
          src={imageUrl}
          alt={product.translation_refs[0]?.title ?? ''}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-br from-[#001731]/90 via-[#3DA9E0]/60 to-[#001731]/85" />
        
        <div className="absolute inset-0">
          <div className="max-w-6xl mx-auto px-4 h-full flex items-center">
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12"
            >
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Badge className={categoryColors[product.category]}>
                  {product.category}
                </Badge>
                {product.member_only && (
                  <Badge className="bg-orange-500 text-white border-0">
                    <Users className="w-3 h-3 mr-1" />
                    Members Only
                  </Badge>
                )}
                {hasDiscount && savings > 0 && (
                  <Badge className="bg-green-500 text-white border-0">
                    <Tag className="w-3 h-3 mr-1" />
                    Save {savings} NOK
                  </Badge>
                )}
              </div>
              
              <h1 className="text-white mb-4 text-4xl md:text-5xl font-bold">{product.translation_refs[0]?.title ?? ''}</h1>
              
              <div className="flex items-baseline gap-3">
                {hasDiscount ? (
                  <>
                    <span className="text-3xl text-white font-bold">{formatPrice(displayPrice)}</span>
                    <span className="text-xl text-white/60 line-through">{formatPrice(product.regular_price)}</span>
                    <Badge className="bg-green-500 text-white border-0">
                      Member Discount
                    </Badge>
                  </>
                ) : (
                  <span className="text-3xl text-white font-bold">{formatPrice(displayPrice)}</span>
                )}
              </div>
              
              {!isMember && product.member_price && product.member_price < product.regular_price && (
                <p className="text-white/80 mt-3 text-lg">
                  🎉 Members pay only {formatPrice(product.member_price)} - Save {product.regular_price - product.member_price} NOK!
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-8 border-0 shadow-lg">
                <h2 className="text-gray-900 mb-4 text-2xl font-bold">Product Description</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {product.translation_refs[0]?.description ?? ''}
                </p>
              </Card>
            </motion.div>

            {/* Product Options */}
            {productOptions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="p-8 border-0 shadow-lg">
                  <h2 className="text-gray-900 mb-6 text-2xl font-bold">Product Options</h2>
                  <div className="space-y-6">
                    {productOptions.map((option, index) => (
                      <div key={index}>
                        <Label className="mb-2 block font-semibold">
                          {option.label}
                          {option.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        
                        {option.type === 'select' && option.options ? (
                          <Select
                            value={selectedOptions[`option-${index}`] || ''}
                            onValueChange={(value) => handleOptionChange(index, value)}
                          >
                            <SelectTrigger 
                              className={`w-full ${errors[`option-${index}`] ? 'border-red-500' : ''}`}
                            >
                              <SelectValue placeholder={`Select ${option.label.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {option.options.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type="text"
                            placeholder={option.placeholder || option.label}
                            value={selectedOptions[`option-${index}`] || ''}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            className={errors[`option-${index}`] ? 'border-red-500' : ''}
                          />
                        )}
                        
                        {errors[`option-${index}`] && (
                          <p className="text-red-500 text-sm mt-1">This field is required</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Pickup Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-6 border-0 shadow-lg bg-blue-50">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="mb-2 text-gray-900 font-semibold">Campus Pickup</h4>
                    <p className="text-sm text-gray-700 mb-2">
                      All products are available for pickup at the BISO office. No shipping, no hassle!
                    </p>
                    <div className="text-sm text-gray-600">
                      <strong>BISO Office:</strong> Main Building, Ground Floor<br />
                      <strong>Hours:</strong> Monday-Friday, 10:00-16:00<br />
                      <strong>Pickup:</strong> Within 5 working days of purchase
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stock Status */}
            {product.stock !== null && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className={`p-6 border-0 shadow-lg ${
                  isLoadingStock ? 'bg-gray-50' :
                  availableStock === 0 ? 'bg-red-50' : 
                  (availableStock !== null && availableStock <= 10) ? 'bg-orange-50' : 
                  'bg-green-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <Package className={`w-5 h-5 ${
                      isLoadingStock ? 'text-gray-600' :
                      availableStock === 0 ? 'text-red-600' : 
                      (availableStock !== null && availableStock <= 10) ? 'text-orange-600' : 
                      'text-green-600'
                    }`} />
                    <div className="flex-1">
                      <div className="text-gray-900 font-semibold">
                        {isLoadingStock ? 'Checking availability...' :
                         availableStock === 0 ? 'Out of Stock' :
                         (availableStock !== null && availableStock <= 10) ? `Only ${availableStock} available!` :
                         'In Stock'}
                      </div>
                      {!isLoadingStock && availableStock !== null && availableStock > 10 && (
                        <div className="text-sm text-gray-600">{availableStock} available</div>
                      )}
                      {!isLoadingStock && availableStock !== null && availableStock < product.stock && (
                        <div className="text-xs text-gray-500 mt-1">
                          {product.stock - availableStock} reserved in carts
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Add to Cart */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-6 border-0 shadow-lg bg-linear-to-br from-[#001731] to-[#3DA9E0]">
                <div className="text-center mb-6">
                  {hasDiscount ? (
                    <>
                      <div className="text-sm text-white/80 line-through mb-1">
                        {formatPrice(product.regular_price)}
                      </div>
                      <div className="text-4xl text-white font-bold mb-2">
                        {formatPrice(displayPrice)}
                      </div>
                      <Badge className="bg-white/20 text-white border-0">
                        Save {savings} NOK
                      </Badge>
                    </>
                  ) : (
                    <div className="text-4xl text-white font-bold">
                      {formatPrice(displayPrice)}
                    </div>
                  )}
                </div>

                {!isMember && product.member_price && product.member_price < product.regular_price && (
                  <Alert className="mb-4 bg-white/10 border-white/20">
                    <AlertCircle className="h-4 w-4 text-white" />
                    <AlertDescription className="text-white text-sm">
                      Become a BISO member to save {product.regular_price - product.member_price} NOK on this item!
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  onClick={handleAddToCart}
                  disabled={product.stock === 0}
                  className="w-full bg-white text-[#001731] hover:bg-white/90 mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                </Button>

                {addedToCart && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 text-white text-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Added to cart!
                  </motion.div>
                )}
              </Card>
            </motion.div>

            {/* Price Breakdown */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-6 border-0 shadow-lg">
                <h3 className="mb-4 text-gray-900 font-bold">Price Details</h3>
                <div className="space-y-3">
                  {!isMember && product.member_price && product.member_price < product.regular_price ? (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span>Regular Price</span>
                          <span>{formatPrice(product.regular_price)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-[#3DA9E0]">
                        <span>Member Price</span>
                        <span>{formatPrice(product.member_price)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-green-600">
                        <span>Member Savings</span>
                        <span>-{product.regular_price - product.member_price} NOK</span>
                      </div>
                    </>
                  ) : hasDiscount ? (
                    <>
                      <div className="flex justify-between text-gray-400 line-through">
                        <span>Regular Price</span>
                        <span>{formatPrice(product.regular_price)}</span>
                      </div>
                      <div className="flex justify-between text-green-600">
                        <span>Member Discount</span>
                        <span>-{savings} NOK</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-gray-900 font-semibold">
                        <span>Your Price</span>
                        <span>{formatPrice(displayPrice)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-gray-900 font-semibold">
                      <span>Price</span>
                      <span>{formatPrice(displayPrice)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Shipping</span>
                    <span className="text-green-600 font-medium">Free (Campus Pickup)</span>
                  </div>
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Tax</span>
                    <span>Included</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Member Benefits */}
            {!isMember && product.category !== 'Membership' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="p-6 border-0 shadow-lg bg-linear-to-br from-orange-50 to-yellow-50">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="mb-2 text-gray-900 font-semibold">Not a member yet?</h4>
                      <p className="text-sm text-gray-700 mb-3">
                        Join BISO from just 350 NOK/semester and enjoy:
                      </p>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>✓ Discounts on all shop items</li>
                        <li>✓ Member-only events</li>
                        <li>✓ Priority registration</li>
                        <li>✓ Partner discounts</li>
                      </ul>
                      <p className="text-xs text-gray-500 mt-2 mb-3">
                        💡 Best value: Year membership 550 NOK | 3-year 1200 NOK
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-2 border-orange-300 text-orange-700 hover:bg-orange-100"
                        onClick={() => router.push('/shop?category=Membership')}
                      >
                        Become a Member
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

