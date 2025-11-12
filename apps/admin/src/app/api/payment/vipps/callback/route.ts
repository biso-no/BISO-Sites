import { NextResponse } from 'next/server'
import { createAdminClient } from '@repo/api/server'
import { handleVippsCallback } from '@repo/payment/vipps'
import { headers } from 'next/headers'

/**
 * Vipps Checkout Webhook Callback Endpoint
 * 
 * This endpoint is called by Vipps when payment status changes.
 * The callback URL is configured when creating the checkout session.
 * 
 * Uses Admin client because webhooks don't have user sessions.
 * 
 * States that trigger callbacks:
 * - CREATED: Payment initiated
 * - AUTHORIZED: User accepted payment
 * - ABORTED: User cancelled
 * - EXPIRED: Payment timed out
 * - TERMINATED: Merchant cancelled
 */
export async function POST(request: Request) {
    try {
        const headersList = await headers()
        const authToken = headersList.get('authorization')?.replace('Bearer ', '') || ''
        
        // Parse the webhook payload
        const payload = await request.json()
        
        // Extract session ID from payload
        // Vipps sends different structures, so we check multiple paths
        const sessionId = payload?.sessionId || 
                         payload?.checkoutSessionId || 
                         payload?.session?.sessionId ||
                         payload?.reference
        
        if (!sessionId) {
            console.error('No session ID found in webhook payload:', payload)
            return NextResponse.json(
                { success: false, message: 'Missing session ID' },
                { status: 400 }
            )
        }
        
        console.log(`[Vipps Webhook] Received callback for session: ${sessionId}`)
        
        // Get admin database client (webhooks don't have user sessions)
        const { db } = await createAdminClient()
        
        // Handle the callback using our payment package
        const result = await handleVippsCallback(authToken, sessionId, db)
        
        if (!result.success) {
            console.error(`[Vipps Webhook] Failed to process callback: ${result.message}`)
            return NextResponse.json(result, { status: result.message === 'Unauthorized' ? 401 : 400 })
        }
        
        console.log(`[Vipps Webhook] Successfully processed callback for session: ${sessionId}`)
        return NextResponse.json(result, { status: 200 })
        
    } catch (error) {
        console.error('[Vipps Webhook] Error processing webhook:', error)
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        )
    }
}

