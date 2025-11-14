import { Suspense } from "react"
import { createSessionClient } from "@repo/api/server"
import { getUserById } from "@/lib/actions/user"
import { getCampuses } from "@/app/actions/campus"
import { UserForm } from "./user-form"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

async function UserDetails({ userId }: { userId: string }) {
  try {
    // Fetch user and campuses data in parallel
    const [userData, campusesData] = await Promise.all([
      getUserById(userId),
      getCampuses()
    ])
    
    const user = userData
    
    if (!user) {
      notFound()
    }
    
    return (
      <UserForm user={user} campuses={campusesData} />
    )
  } catch (error) {
    console.error("Error fetching user data:", error)
    notFound()
  }
}

export default async function UserDetailsPage({ params }: { params: { userId: string } }) {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Suspense fallback={<div>Loading user details...</div>}>
        <UserDetails userId={params.userId} />
      </Suspense>
    </div>
  )
}