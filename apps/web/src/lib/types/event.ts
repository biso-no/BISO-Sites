import { Models } from '@repo/api'
import { ContentTranslation } from './content-translation'

export interface Event extends Models.Row {
  slug?: string
  status: 'draft' | 'published' | 'cancelled'
  campus_id: string
  metadata?: string // JSON string for non-translatable data (dates, location, price, etc.)
  // Relationship references (populated at runtime)
  campus?: { $id: string; name: string }
  translations?: ContentTranslation[]
}

// Helper interface for working with event data including translations
export interface EventWithTranslations extends Event {
  // Convenience properties for the current locale
  title: string
  description: string
  start_date?: string
  end_date?: string
  location: string
  price: number
  ticket_url: string
  image: string
}


