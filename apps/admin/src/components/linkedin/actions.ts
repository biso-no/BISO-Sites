"use server"

import { createSessionClient, createAdminClient } from "@repo/api/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Query } from "@repo/api/server"

// Define the response type for LinkedIn API
interface LinkedInProfileResponse {
  id: string  // LinkedIn member ID
  localizedFirstName: string
  localizedLastName: string
  profilePicture?: {
    displayImage: string
  }
  email?: string
}

/**
 * Initiates the LinkedIn OAuth flow
 * This will redirect the user to LinkedIn's authentication page
 */
export async function connectLinkedIn(userId: string) {
  try {
    // For server components, we need to return the URL to redirect to
    // The actual redirection happens on the client side
    const origin = (await headers()).get("origin");
    
    // Create success and failure URLs
    const successUrl = `${origin}/alumni/profile?linkedin=true`
    const failureUrl = `${origin}/alumni/profile?linkedin=false`
    
    // Return the parameters needed for client-side OAuth initialization
    return { 
      success: true,
      provider: 'linkedin',
      successUrl,
      failureUrl
    }
  } catch (error) {
    console.error("Error creating LinkedIn session:", error)
    return { success: false, message: "Failed to connect with LinkedIn" }
  }
}

/**
 * Syncs the user's LinkedIn profile data with their alumni profile
 * Limited to basic profile data available from LinkedIn's API
 */
export async function syncLinkedInProfile(userId: string) {
  try {
    const appwrite = await createSessionClient()
    const admin = await createAdminClient()
    
    // First, check if the user has a LinkedIn account connected
    const account = await appwrite.account.get()
    
    // Look for LinkedIn provider in the user's identities
    const identities = await appwrite.account.listIdentities()
    const linkedInIdentity = identities.identities.find(
      (identity) => identity.provider === 'linkedin'
    )
    
    if (!linkedInIdentity) {
      return { 
        success: false, 
        message: "No LinkedIn account connected. Please connect your LinkedIn account first." 
      }
    }
    
    // LinkedIn OAuth provides very limited data through the standard API
    // We can only access basic profile data
    const linkedInData = {
      name: `${account.name}`,
      avatarUrl: account.prefs?.avatarUrl || undefined,
      // Other fields from LinkedIn would require Partner Program access
    }
    
    // Update the user's profile with LinkedIn data
    const db = admin.db
    
    // Find the user's profile
    const userProfiles = await db.listRows(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PROFILES_ID!,
      [Query.equal('userId', userId)]
    )
    
    if (userProfiles.rows.length === 0) {
      return { success: false, message: "User profile not found" }
    }
    
    const userProfile = userProfiles.rows[0]
    
    // Update the profile with LinkedIn data
    // Only update fields that aren't already populated
    const updateData: Record<string, any> = {}
    
    if (linkedInData.name && (!userProfile.name || userProfile.name === "")) {
      updateData.name = linkedInData.name
    }
    
    if (linkedInData.avatarUrl && (!userProfile.avatarUrl || userProfile.avatarUrl === "")) {
      updateData.avatarUrl = linkedInData.avatarUrl
    }
    
    // Add a social link for LinkedIn if not already present
    const socialLinks = userProfile.socialLinks || []
    const hasLinkedIn = socialLinks.some((link: any) => link.platform === 'linkedin')
    
    if (!hasLinkedIn) {
      // Create a new social link document for LinkedIn
      await db.createDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_SOCIAL_LINKS_ID!,
        'unique()',
        {
          platform: 'linkedin',
          url: `https://www.linkedin.com/in/${linkedInIdentity.providerUid || 'profile'}`,
          userId: userId
        }
      )
    }
    
    // Only update if there are changes
    if (Object.keys(updateData).length > 0) {
      await db.updateDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PROFILES_ID!,
        userProfile.$id,
        updateData
      )
    }
    
    return { success: true }
  } catch (error) {
    console.error("Error syncing LinkedIn profile:", error)
    return { success: false, message: "Failed to sync LinkedIn profile" }
  }
} 