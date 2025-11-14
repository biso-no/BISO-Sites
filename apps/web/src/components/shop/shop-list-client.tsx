'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { motion, AnimatePresence } from 'motion/react'
import { Search, Filter, X, ShoppingBag, Loader2 } from 'lucide-react'
import { Button } from '@repo/ui/components/ui/button'
import { Input } from '@repo/ui/components/ui/input'
import { ProductCard } from './product-card'
import { useCampus } from '@/components/context/campus'
import { listProducts } from '@/app/actions/webshop'
import type { ContentTranslations } from '@repo/api/types/appwrite'

interface ShopListClientProps {
  products: ContentTranslations[]
  isMember?: boolean
}

const categories = ['All', 'Merch', 'Trips', 'Lockers', 'Membership']

export function ShopListClient({ products: initialProducts, isMember = false }: ShopListClientProps) {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'no'
  const { activeCampusId } = useCampus()
  
  const [products, setProducts] = useState<ContentTranslations[]>(initialProducts)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Re-fetch products when campus or locale changes
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true)
      try {
        const newProducts = await listProducts({
          locale,
          status: 'published',
          limit: 100,
          campus: activeCampusId || 'all',
        })
        setProducts(newProducts)
      } catch (error) {
        console.error('Failed to fetch products:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProducts()
  }, [activeCampusId, locale])

  // Filter products based on search and category
  const filteredProducts = products.filter((product) => {
    const productData = product.product_ref
    
    // Filter out member-only products if user is not a member
    if (productData?.member_only && !isMember) return false

    const matchesCategory = selectedCategory === 'All' || productData?.category === selectedCategory
    const matchesSearch =
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.short_description || '').toLowerCase().includes(searchQuery.toLowerCase())

    return matchesCategory && matchesSearch
  })

  const handleViewDetails = (product: ContentTranslations) => {
    const slug = product.product_ref?.slug || product.content_id
    router.push(`/shop/${slug}`)
  }

  return (
    <>
      {/* Filters & Search */}
      <div className="sticky top-20 z-40 bg-white/95 backdrop-blur-lg shadow-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 w-full border-[#3DA9E0]/20 focus:border-[#3DA9E0]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <Filter className="w-5 h-5 text-[#001731]" />
              {categories.map((category) => (
                <Button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  className={
                    selectedCategory === category
                      ? 'bg-[#3DA9E0] text-white hover:bg-[#3DA9E0]/90 border-0'
                      : 'border-[#3DA9E0]/20 text-[#001731] hover:bg-[#3DA9E0]/10'
                  }
                  size="sm"
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-center text-gray-600">
            Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#3DA9E0]" />
            <span className="ml-3 text-gray-600">Loading products...</span>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedCategory + searchQuery}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {filteredProducts.map((product, index) => (
                  <ProductCard
                    key={product.$id}
                    product={product}
                    index={index}
                    isMember={isMember}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </motion.div>
            </AnimatePresence>

            {/* No Results */}
            {filteredProducts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2 text-2xl font-bold">No products found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your search or filters</p>
            <Button
              onClick={() => {
                setSelectedCategory('All')
                setSearchQuery('')
              }}
              variant="outline"
              className="border-[#3DA9E0] text-[#001731] hover:bg-[#3DA9E0]/10"
            >
              Clear Filters
            </Button>
          </motion.div>
        )}
          </>
        )}
      </div>

      {/* Pickup Info */}
      <div className="bg-[#001731] text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="mb-4 text-2xl font-bold">All Products Available for Campus Pickup</h3>
          <p className="text-white/80 mb-4 text-lg">
            All items purchased in the BISO Shop are available for pickup at the BISO office during opening hours.
            No shipping fees, no hassle - just convenient campus pickup!
          </p>
          <p className="text-[#3DA9E0] font-semibold text-lg">
            <strong>BISO Office Hours:</strong> Monday-Friday, 10:00-16:00
          </p>
        </div>
      </div>
    </>
  )
}

