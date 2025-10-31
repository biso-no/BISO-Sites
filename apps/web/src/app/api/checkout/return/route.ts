import { NextResponse } from 'next/server'
import { createAdminClient } from '@repo/api/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get('orderId')
  if (!orderId) return NextResponse.redirect(new URL('/shop', process.env.NEXT_PUBLIC_BASE_URL))

  // Optionally fetch order and show receipt page; for now, redirect to a simple thank-you
  return NextResponse.redirect(new URL(`/shop?order=${orderId}`, process.env.NEXT_PUBLIC_BASE_URL))
}


