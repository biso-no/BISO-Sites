import { NextResponse } from 'next/server'
import { createAdminClient } from '@repo/api/server'

export async function POST(req: Request) {
  try {
    const payload = await req.json()
    console.log('Vipps webhook received:', JSON.stringify(payload, null, 2))
    
    const { db } = await createAdminClient()

    // Handle different webhook payload structures
    const sessionId = payload?.sessionId || payload?.id || payload?.session?.sessionId || null
    const reference = payload?.transaction?.reference || payload?.reference || payload?.session?.reference || null
    const status = payload?.status || payload?.transaction?.status || payload?.session?.status || ''

    if (!reference) {
      console.log('No reference found in webhook payload, skipping')
      return NextResponse.json({ ok: true })
    }

    // Map Vipps status to our order status
    const statusLower = (status || '').toLowerCase()
    let newStatus = 'pending'
    
    if (statusLower.includes('captured') || statusLower.includes('completed') || statusLower === 'paid') {
      newStatus = 'paid'
    } else if (statusLower.includes('authorized') || statusLower === 'authorized') {
      newStatus = 'authorized'
    } else if (statusLower.includes('cancel') || statusLower === 'cancelled') {
      newStatus = 'cancelled'
    } else if (statusLower.includes('fail') || statusLower === 'failed' || statusLower.includes('error')) {
      newStatus = 'failed'
    }

    console.log(`Updating order ${reference} status from ${status} to ${newStatus}`)

    await db.updateRow('app', 'orders', reference, {
      status: newStatus,
      vipps_session_id: sessionId || undefined,
    })

    console.log(`Successfully updated order ${reference}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Vipps webhook error:', e)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}


