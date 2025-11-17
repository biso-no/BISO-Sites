import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/actions/notifications'

/**
 * Demo endpoint to create sample notifications for testing
 * DELETE this file before production deployment
 */
export async function POST() {
  try {
    const sampleNotifications = [
      {
        title: 'New Order Received',
        description: 'Order #ABC123 for 1,250 NOK has been placed',
        color: 'green',
        priority: 2,
        link: '/admin/shop/orders',
      },
      {
        title: 'Expense Awaiting Approval',
        description: 'John Smith submitted an expense of 500 NOK for review',
        color: 'orange',
        priority: 3,
        link: '/admin/expenses',
      },
      {
        title: 'New Job Application',
        description: 'Sarah Johnson applied for Marketing Manager position',
        color: 'green',
        priority: 2,
        link: '/admin/jobs/applications',
      },
      {
        title: 'Low Stock Alert',
        description: 'BISO T-Shirt (Medium) has only 3 items left in stock',
        color: 'orange',
        priority: 2,
        link: '/admin/shop/products',
      },
      {
        title: 'System Update',
        description: 'New features have been deployed to the admin panel',
        color: 'blue',
        priority: 1,
        link: '/admin',
      },
    ]

    const results = await Promise.all(
      sampleNotifications.map((notification) => createNotification(notification))
    )

    const successful = results.filter((r) => r.success).length

    return NextResponse.json({
      success: true,
      message: `Created ${successful} out of ${sampleNotifications.length} sample notifications`,
    })
  } catch (error) {
    console.error('[api/notifications/demo] Failed to create sample notifications:', error)
    return NextResponse.json(
      { error: 'Failed to create sample notifications' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'

