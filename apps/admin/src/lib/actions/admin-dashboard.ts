'use server'

import { revalidatePath } from 'next/cache'

// Types for our data
type PageView = { name: string; views: number }
type UserDistribution = { name: string; value: number }
type UserGrowth = { date: string; users: number }
type TrafficSource = { name: string; value: number }
type RecentActivity = { id: number; user: string; action: string; timestamp: string }
type SystemAlert = { id: number; type: string; message: string; timestamp: string }

// Admin data fetching actions
export async function getPageViews(): Promise<PageView[]> {
  // In a real application, you would fetch this data from your database or analytics service
  const data = [
    { name: "Home", views: 5000 },
    { name: "About", views: 3000 },
    { name: "Services", views: 4000 },
    { name: "Contact", views: 2000 },
    { name: "Blog", views: 3500 },
    { name: "Products", views: 4500 },
  ]
  
  return data
}

export async function getUserDistribution(): Promise<UserDistribution[]> {
  const data = [
    { name: "New", value: 400 },
    { name: "Returning", value: 300 },
    { name: "Inactive", value: 100 },
    { name: "VIP", value: 50 },
  ]
  
  return data
}

export async function getUserGrowth(): Promise<UserGrowth[]> {
  const data = [
    { date: "2023-01", users: 1000 },
    { date: "2023-02", users: 1200 },
    { date: "2023-03", users: 1500 },
    { date: "2023-04", users: 1800 },
    { date: "2023-05", users: 2200 },
    { date: "2023-06", users: 2500 },
  ]
  
  return data
}

export async function getTrafficSources(): Promise<TrafficSource[]> {
  const data = [
    { name: "Direct", value: 400 },
    { name: "Organic Search", value: 300 },
    { name: "Paid Search", value: 200 },
    { name: "Social Media", value: 150 },
    { name: "Referral", value: 100 },
  ]
  
  return data
}

export async function getRecentActivities(): Promise<RecentActivity[]> {
  const data = [
    { id: 1, user: "John Doe", action: "Created a new page", timestamp: "2023-06-15 10:30" },
    { id: 2, user: "Jane Smith", action: "Updated product inventory", timestamp: "2023-06-15 11:45" },
    { id: 3, user: "Mike Johnson", action: "Approved a refund request", timestamp: "2023-06-15 13:20" },
    { id: 4, user: "Sarah Williams", action: "Published a new blog post", timestamp: "2023-06-15 14:55" },
    { id: 5, user: "Chris Brown", action: "Responded to a support ticket", timestamp: "2023-06-15 16:10" },
  ]
  
  return data
}

export async function getSystemAlerts(): Promise<SystemAlert[]> {
  const data = [
    { id: 1, type: "error", message: "Server CPU usage above 90%", timestamp: "2023-06-15 09:15" },
    { id: 2, type: "warning", message: "Database storage at 85% capacity", timestamp: "2023-06-15 11:30" },
    { id: 3, type: "info", message: "New software update available", timestamp: "2023-06-15 14:45" },
    { id: 4, type: "success", message: "Backup completed successfully", timestamp: "2023-06-15 18:00" },
  ]
  
  return data
}

// PR data fetching actions
export async function getPostEngagement() {
  const data = [
    { name: "Post 1", likes: 500, comments: 100, shares: 50 },
    { name: "Post 2", likes: 300, comments: 80, shares: 30 },
    { name: "Post 3", likes: 700, comments: 150, shares: 100 },
    { name: "Post 4", likes: 450, comments: 90, shares: 40 },
    { name: "Post 5", likes: 600, comments: 120, shares: 80 },
  ]
  
  return data
}

export async function getAudienceGrowth() {
  const data = [
    { date: "2023-01", followers: 10000 },
    { date: "2023-02", followers: 12000 },
    { date: "2023-03", followers: 15000 },
    { date: "2023-04", followers: 18000 },
    { date: "2023-05", followers: 22000 },
    { date: "2023-06", followers: 25000 },
  ]
  
  return data
}

// Finance data fetching actions
export async function getRevenueByProduct() {
  const data = [
    { name: "Product A", revenue: 50000 },
    { name: "Product B", revenue: 30000 },
    { name: "Product C", revenue: 20000 },
    { name: "Product D", revenue: 40000 },
    { name: "Product E", revenue: 35000 },
  ]
  
  return data
}

export async function getExpenseCategories() {
  const data = [
    { category: "Salaries", amount: 50000 },
    { category: "Marketing", amount: 20000 },
    { category: "Operations", amount: 15000 },
    { category: "Technology", amount: 10000 },
    { category: "Office", amount: 5000 },
  ]
  
  return data
}

// HR data fetching actions
export async function getJobApplications() {
  const data = [
    { position: "Software Engineer", applications: 50, openPositions: 3 },
    { position: "Designer", applications: 30, openPositions: 2 },
    { position: "Marketing Specialist", applications: 40, openPositions: 1 },
    { position: "Sales Representative", applications: 25, openPositions: 4 },
    { position: "Product Manager", applications: 35, openPositions: 2 },
  ]
  
  return data
}

export async function getEmployeeDistribution() {
  const data = [
    { name: "Engineering", value: 40 },
    { name: "Design", value: 20 },
    { name: "Marketing", value: 15 },
    { name: "Sales", value: 25 },
    { name: "Management", value: 10 },
  ]
  
  return data
}

// Utility function for data updates that need to trigger revalidation
export async function revalidateDashboard() {
  revalidatePath('/admin/dashboard')
}
