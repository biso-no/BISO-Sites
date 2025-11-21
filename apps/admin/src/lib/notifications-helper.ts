/**
 * Helper functions to trigger notifications from server actions
 * These functions can be called after important admin actions to notify users
 */

import { createNotification } from "@/lib/actions/notifications";

export const NotificationTriggers = {
  /**
   * Shop notifications
   */
  onNewOrder: async (orderId: string, amount: number) => {
    await createNotification({
      title: "New Order Received",
      description: `Order #${orderId.slice(-6)} for ${amount} NOK has been placed`,
      color: "green",
      priority: 2,
      link: `/admin/shop/orders/${orderId}`,
    });
  },

  onOrderCancelled: async (orderId: string) => {
    await createNotification({
      title: "Order Cancelled",
      description: `Order #${orderId.slice(-6)} has been cancelled`,
      color: "orange",
      priority: 2,
      link: `/admin/shop/orders/${orderId}`,
    });
  },

  onLowStock: async (productName: string, quantity: number) => {
    await createNotification({
      title: "Low Stock Alert",
      description: `${productName} has only ${quantity} items left in stock`,
      color: "orange",
      priority: 2,
      link: "/admin/shop/products",
    });
  },

  /**
   * User management notifications
   */
  onNewUserRegistration: async (userName: string, userId: string) => {
    await createNotification({
      title: "New User Registered",
      description: `${userName} has joined the platform`,
      color: "blue",
      priority: 1,
      link: `/admin/users/${userId}`,
    });
  },

  onUserRoleChanged: async (userName: string, newRole: string) => {
    await createNotification({
      title: "User Role Updated",
      description: `${userName}'s role has been changed to ${newRole}`,
      color: "blue",
      priority: 1,
      link: "/admin/users",
    });
  },

  /**
   * Job applications notifications
   */
  onNewJobApplication: async (
    jobTitle: string,
    applicantName: string,
    _applicationId: string
  ) => {
    await createNotification({
      title: "New Job Application",
      description: `${applicantName} applied for ${jobTitle}`,
      color: "green",
      priority: 2,
      link: "/admin/jobs/applications",
    });
  },

  /**
   * Expense notifications
   */
  onExpenseNeedsApproval: async (
    expenseId: string,
    amount: number,
    submitter: string
  ) => {
    await createNotification({
      title: "Expense Awaiting Approval",
      description: `${submitter} submitted an expense of ${amount} NOK for review`,
      color: "orange",
      priority: 3,
      link: `/admin/expenses/${expenseId}`,
    });
  },

  onExpenseApproved: async (expenseId: string) => {
    await createNotification({
      title: "Expense Approved",
      description: `Expense #${expenseId.slice(-6)} has been approved`,
      color: "green",
      priority: 1,
      link: `/admin/expenses/${expenseId}`,
    });
  },

  onExpenseRejected: async (expenseId: string, reason: string) => {
    await createNotification({
      title: "Expense Rejected",
      description: `Expense #${expenseId.slice(-6)} was rejected: ${reason}`,
      color: "red",
      priority: 2,
      link: `/admin/expenses/${expenseId}`,
    });
  },

  /**
   * System notifications
   */
  onSystemError: async (errorType: string, message: string) => {
    await createNotification({
      title: `System Error: ${errorType}`,
      description: message,
      color: "red",
      priority: 3,
      link: "/admin",
    });
  },

  onSystemMaintenance: async (scheduledTime: string) => {
    await createNotification({
      title: "Scheduled Maintenance",
      description: `System maintenance is scheduled for ${scheduledTime}`,
      color: "orange",
      priority: 2,
      link: "/admin",
    });
  },

  /**
   * Event notifications
   */
  onEventPublished: async (eventTitle: string, eventId: string) => {
    await createNotification({
      title: "Event Published",
      description: `"${eventTitle}" is now live`,
      color: "green",
      priority: 1,
      link: `/admin/events/${eventId}`,
    });
  },

  onEventCancelled: async (eventTitle: string) => {
    await createNotification({
      title: "Event Cancelled",
      description: `"${eventTitle}" has been cancelled`,
      color: "red",
      priority: 2,
      link: "/admin/events",
    });
  },

  /**
   * Varsling (whistleblowing) notifications
   */
  onNewVarslingReport: async (_reportId: string) => {
    await createNotification({
      title: "New Varsling Report",
      description: "A new confidential report has been submitted",
      color: "red",
      priority: 3,
      link: "/admin/varsling",
    });
  },

  /**
   * Custom notification
   */
  custom: async (
    title: string,
    description: string,
    options?: {
      color?: string;
      priority?: number;
      link?: string;
    }
  ) => {
    await createNotification({
      title,
      description,
      color: options?.color || "blue",
      priority: options?.priority || 1,
      link: options?.link,
    });
  },
};
