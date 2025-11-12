"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type User = {
  id: string
  username: string
  email: string
  name: string
  roles: string[]
  isActive: boolean
}

const availableRoles = ["User", "HR", "PR", "KK", "Finance", "Admin"]

export default function UserDetailsManagement() {
  const [user, setUser] = useState<User>({
    id: "user-1",
    username: "johndoe",
    email: "john.doe@example.com",
    name: "John Doe",
    roles: ["User", "HR"],
    isActive: true,
  })

  const [isEditing, setIsEditing] = useState(false)
  const [showResetPasswordAlert, setShowResetPasswordAlert] = useState(false)

  const handleRoleChange = (role: string) => {
    if (role === "Admin") {
      setUser({ ...user, roles: ["Admin"] })
    } else {
      const newRoles = user.roles.includes(role)
        ? user.roles.filter((r) => r !== role)
        : [...user.roles.filter((r) => r !== "Admin"), role]
      setUser({ ...user, roles: newRoles })
    }
  }

  const handleSave = () => {
    // Here you would typically send the updated user data to your backend
    console.log("Saving user data:", user)
    setIsEditing(false)
  }

  const handleResetPassword = () => {
    // Here you would typically call an API to reset the user's password
    console.log("Resetting password for user:", user.id)
    setShowResetPasswordAlert(true)
    setTimeout(() => setShowResetPasswordAlert(false), 5000) // Hide alert after 5 seconds
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>User Details & Management</CardTitle>
          <CardDescription>View and edit user information, manage roles, and perform account actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={user.username}
                onChange={(e) => setUser({ ...user, username: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user.email}
                onChange={(e) => setUser({ ...user, email: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={user.name}
                onChange={(e) => setUser({ ...user, name: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label>Account Status</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={user.isActive}
                  onCheckedChange={(checked) => setUser({ ...user, isActive: checked })}
                  disabled={!isEditing}
                />
                <span>{user.isActive ? "Active" : "Disabled"}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {availableRoles.map((role) => (
                <div key={role} className="flex items-center space-x-2">
                  <Checkbox
                    id={`role-${role}`}
                    checked={user.roles.includes(role)}
                    onCheckedChange={() => handleRoleChange(role)}
                    disabled={!isEditing || (role !== "Admin" && user.roles.includes("Admin"))}
                  />
                  <Label htmlFor={`role-${role}`}>{role}</Label>
                </div>
              ))}
            </div>
          </div>
          {showResetPasswordAlert && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Password Reset</AlertTitle>
              <AlertDescription>
                A password reset link has been sent to the user&apos;s email address.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <div>
            <Button variant="outline" onClick={handleResetPassword} className="mr-2">
              Reset Password
            </Button>
            {isEditing ? (
              <Button onClick={handleSave}>Save Changes</Button>
            ) : (
              <Button onClick={() => setIsEditing(true)}>Edit User</Button>
            )}
          </div>
          {isEditing && (
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}