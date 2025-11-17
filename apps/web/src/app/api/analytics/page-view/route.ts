
import { NextResponse, type NextRequest } from 'next/server'
import { ID } from '@repo/api'
import { createAdminClient, createSessionClient } from '@repo/api/server'

const DATABASE_ID = 'app'
const TABLE_ID = 'page_view_events'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null) as {
      path?: string
      locale?: string
      referrer?: string | null
    } | null

    const path = payload?.path?.trim()
    if (!path) {
      return NextResponse.json({ success: false, error: 'Missing path' }, { status: 400 })
    }

    const locale = payload?.locale?.trim() || null
    const referrer = payload?.referrer?.trim() || null

    const headers = request.headers
    const userAgent = headers.get('user-agent')?.slice(0, 255) || null
    const forwarded = headers.get('x-forwarded-for') || headers.get('x-real-ip')
    const visitorIp = forwarded?.split(',')[0]?.trim() || null

    let userId: string | null = null
    try {
      const { account } = await createSessionClient()
      const currentUser = await account.get()
      userId = currentUser.$id
    } catch {
      // Ignore missing session
    }

    const { db } = await createAdminClient()
    await db.createRow(DATABASE_ID, TABLE_ID, ID.unique(), {
      path,
      locale,
      referrer,
      user_agent: userAgent,
      visitor_ip: visitorIp,
      user_id: userId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[analytics] Failed to record page view', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}