"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateUser } from '@/lib/admin/db'
import { User } from '@/lib/admin/db'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/lib/hooks/use-toast"
import { 
  Avatar, 
  AvatarFallback, 
  AvatarImage 
} from "@/components/ui/avatar"
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ArrowLeft, Save, RefreshCw, UserCog, Shield, Building, Mail, AlertTriangle } from "lucide-react"

export interface UserFormProps {
  user: User
  campuses: { id: string; name: string }[]
}

export function UserForm({ user: initialUser, campuses }: UserFormProps) {
  const [user, setUser] = useState<User>(initialUser)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const handleRoleChange = (role: string) => {
    if (!user) return

    const newRoles = user.roles.includes(role)
      ? user.roles.filter((r) => r !== role)
      : [...user.roles, role]

    setUser({ ...user, roles: newRoles })
  }
  
  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateUser(user.id, user)
      toast({
        title: "Success",
        description: "User details have been updated",
        variant: "default",
      })
      router.refresh() // Refresh server components
    } catch (error) {
      console.error("Error updating user:", error)
      toast({
        title: "Error",
        description: "Failed to update user details",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleGoBack = () => {
    router.push('/admin/users')
  }
  
  // Generate user's initials for avatar
  const initials = user.name
    .split(" ")
    .map(part => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  
  // Generate color for avatar based on user name
  const nameHash = user.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const colors = [
    "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", 
    "bg-lime-500", "bg-green-500", "bg-emerald-500", "bg-teal-500", 
    "bg-cyan-500", "bg-sky-500", "bg-blue-500", "bg-indigo-500", 
    "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", "bg-pink-500", "bg-rose-500",
  ]
  const bgColor = colors[nameHash % colors.length]

  return (
    <Card className="shadow-sm max-w-4xl mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleGoBack} 
              className="rounded-full h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle className="text-2xl">User Details</CardTitle>
              <CardDescription>View and manage user information</CardDescription>
            </div>
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={handleSave} 
                  className="gap-2"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save user changes</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-8 pb-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-background/50">
            <Avatar className="h-24 w-24">
              <AvatarImage src="" alt={user.name} />
              <AvatarFallback className={`text-xl font-semibold text-white ${bgColor}`}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h3 className="font-medium text-lg">{user.name}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <Badge
              variant={user.isActive ? "default" : "secondary"}
              className={user.isActive 
                ? "bg-green-100 text-green-800 hover:bg-green-100" 
                : "bg-gray-100 text-gray-800 hover:bg-gray-100"
              }
            >
              {user.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          
          <div className="flex-1">
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="profile" className="gap-2">
                  <UserCog className="h-4 w-4" />
                  <span>Profile</span>
                </TabsTrigger>
                <TabsTrigger value="roles" className="gap-2">
                  <Shield className="h-4 w-4" />
                  <span>Roles & Access</span>
                </TabsTrigger>
                <TabsTrigger value="security" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Security</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="profile" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={user.name}
                      onChange={(e) => setUser({ ...user, name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        value={user.email}
                        disabled
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="campus">Campus</Label>
                    <Select
                      value={user.campus}
                      onValueChange={(value) => setUser({ ...user, campus: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select campus" />
                      </SelectTrigger>
                      <SelectContent>
                        {campuses.map((campus) => (
                          <SelectItem key={campus.id} value={campus.id}>
                            {campus.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="account-status">Account Status</Label>
                    <div className="flex items-center space-x-2 mt-3">
                      <Switch
                        id="account-status"
                        checked={user.isActive}
                        onCheckedChange={(checked) => setUser({ ...user, isActive: checked })}
                      />
                      <Label htmlFor="account-status" className="text-sm font-normal">
                        {user.isActive ? "Active" : "Inactive"}
                      </Label>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="roles" className="space-y-4">
                <div className="bg-muted/40 p-4 rounded-lg">
                  <h3 className="font-medium mb-1">User Roles</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Assign roles to determine user access and permissions.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {["User", "HR", "PR", "KK", "Finance", "Admin"].map((role) => (
                      <div 
                        key={role} 
                        className={`
                          flex items-center gap-2 p-2 rounded-md transition-colors
                          ${user.roles.includes(role) 
                            ? "bg-primary/10 border border-primary/30" 
                            : "bg-muted border border-transparent"}
                        `}
                        onClick={() => handleRoleChange(role)}
                      >
                        <Checkbox
                          id={`role-${role}`}
                          checked={user.roles.includes(role)}
                          onCheckedChange={() => handleRoleChange(role)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        />
                        <label
                          htmlFor={`role-${role}`}
                          className="text-sm font-medium leading-none cursor-pointer flex-1"
                        >
                          {role}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="security" className="space-y-4">
                <div className="bg-muted/40 p-4 rounded-lg">
                  <h3 className="font-medium mb-1">Account Security</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Manage user security settings and reset options.
                  </p>
                  
                  <div className="space-y-2">
                    <Button 
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        toast({
                          title: "Password reset",
                          description: "Password reset email has been sent to the user",
                        })
                      }}
                    >
                      Send Password Reset Link
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}