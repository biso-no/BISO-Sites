'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface CartItem {
  id: string // unique cart item id (contentId + options hash)
  contentId: string // product content_id from database
  productId: string // product webshop_products id
  slug: string
  name: string
  image: string | null
  category: string
  regularPrice: number
  memberPrice: number | null
  memberOnly: boolean
  quantity: number
  stock: number | null
  selectedOptions?: Record<string, string>
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'id' | 'quantity'> & { quantity?: number }) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  getItemCount: () => number
  getSubtotal: (isMember: boolean) => number
  getRegularSubtotal: () => number
  getTotalSavings: (isMember: boolean) => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}

function generateCartItemId(contentId: string, selectedOptions?: Record<string, string>): string {
  const optionsHash = selectedOptions 
    ? Object.entries(selectedOptions)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join('|')
    : ''
  return `${contentId}${optionsHash ? `-${btoa(optionsHash)}` : ''}`
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [mounted, setMounted] = useState(false)

  // Load cart from localStorage on mount
  useEffect(() => {
    setMounted(true)
    const storedCart = localStorage.getItem('biso-cart')
    if (storedCart) {
      try {
        setItems(JSON.parse(storedCart))
      } catch (error) {
        console.error('Failed to parse cart from localStorage:', error)
      }
    }
  }, [])

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('biso-cart', JSON.stringify(items))
    }
  }, [items, mounted])

  const addItem = (item: Omit<CartItem, 'id' | 'quantity'> & { quantity?: number }) => {
    const id = generateCartItemId(item.contentId, item.selectedOptions)
    const quantity = item.quantity || 1

    setItems((prevItems) => {
      const existingItem = prevItems.find((i) => i.id === id)
      
      if (existingItem) {
        // Update quantity if item already exists
        const newQuantity = existingItem.quantity + quantity
        // Check stock limit
        const maxQuantity = item.stock !== null ? Math.min(newQuantity, item.stock) : newQuantity
        
        return prevItems.map((i) =>
          i.id === id ? { ...i, quantity: maxQuantity } : i
        )
      }
      
      // Add new item
      const newItem: CartItem = {
        ...item,
        id,
        quantity,
      }
      return [...prevItems, newItem]
    })
  }

  const removeItem = (itemId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== itemId))
  }

  const updateQuantity = (itemId: string, quantity: number) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === itemId) {
          const newQuantity = Math.max(1, quantity)
          // Check stock limit
          const maxQuantity = item.stock !== null ? Math.min(newQuantity, item.stock) : newQuantity
          return { ...item, quantity: maxQuantity }
        }
        return item
      })
    )
  }

  const clearCart = () => {
    setItems([])
  }

  const getItemCount = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }

  const getSubtotal = (isMember: boolean) => {
    return items.reduce((sum, item) => {
      const price = isMember && item.memberPrice ? item.memberPrice : item.regularPrice
      return sum + price * item.quantity
    }, 0)
  }

  const getRegularSubtotal = () => {
    return items.reduce((sum, item) => sum + item.regularPrice * item.quantity, 0)
  }

  const getTotalSavings = (isMember: boolean) => {
    if (!isMember) return 0
    return getRegularSubtotal() - getSubtotal(isMember)
  }

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getItemCount,
        getSubtotal,
        getRegularSubtotal,
        getTotalSavings,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

