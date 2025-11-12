"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, SlidersHorizontal, Download, UserPlus, RefreshCw, ChevronDown, ChevronUp, Check } from "lucide-react"
import { User } from "@/lib/types/user"
import { useUserStore } from "./user-store"
import { UserAvatar } from "./user-avatar"
import { RoleBadgeList } from "./role-badge"
import { UserStatus } from "./user-status"
import { UserTableSkeleton } from "./user-table-skeleton"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { AdminSummary } from "@/components/admin/admin-summary"
import { formatPercentage } from "@/lib/utils/admin"

export function UserTable({ initialUsers }: { initialUsers: User[] }) {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  
  // Get state and actions from Zustand store
  const {
    users,
    filteredUsers,
    searchTerm,
    filterRole,
    currentPage,
    totalPages,
    usersPerPage,
    selectedUsers,
    sortField,
    sortDirection,
    isLoading,
    setUsers,
    setSearchTerm,
    setFilterRole,
    setCurrentPage,
    toggleUserSelection,
    selectAllUsers,
    setSorting,
    setIsLoading
  } = useUserStore()
  
  // Initialize store with users on component mount
  useEffect(() => {
    setUsers(initialUsers)
    setIsClient(true)
  }, [initialUsers, setUsers])
  
  // Get current page of users
  const indexOfLastUser = currentPage * usersPerPage
  const indexOfFirstUser = indexOfLastUser - usersPerPage
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser)

  const totalCount = filteredUsers.length
  const activeCount = useMemo(() => filteredUsers.filter((user) => user.isActive).length, [filteredUsers])
  const inactiveCount = useMemo(() => filteredUsers.filter((user) => !user.isActive).length, [filteredUsers])
  const rosterSource = users.length ? users : initialUsers
  const activeRate = formatPercentage(activeCount, totalCount || 0)

  const uniqueRoles = useMemo(
    () =>
      Array.from(
        new Set(
          rosterSource.flatMap((user) => (Array.isArray(user.roles) ? user.roles : []))
        )
      ),
    [rosterSource]
  )
  const uniqueCampuses = useMemo(
    () =>
      Array.from(
        new Set(
          rosterSource
            .map((user) => user.campus?.name?.trim())
            .filter((name): name is string => !!name && name.length > 0)
        )
      ),
    [rosterSource]
  )

  const summaryMetrics = [
    { label: "Total users", value: totalCount, hint: `${selectedUsers.length} selected` },
    { label: "Active", value: activeCount, hint: `${activeRate} active` },
    { label: "Inactive", value: inactiveCount },
    { label: "Campuses", value: uniqueCampuses.length },
  ]

  const formatMetricValue = (value: number | string) =>
    typeof value === "number" ? value.toLocaleString() : value

  const quickRoleFilters = useMemo(() => {
    const roleEntries = uniqueRoles.slice(0, 4).map((roleName) => ({
      label: roleName,
      value: roleName,
    }))
    return [{ label: "All users", value: "all" }, ...roleEntries]
  }, [uniqueRoles])
  
  // Handle row click to navigate to user detail
  const handleRowClick = (userId: string, e: React.MouseEvent) => {
    // Don't navigate if clicking on checkbox or action buttons
    if ((e.target as HTMLElement).closest('.row-action')) return
    router.push(`/admin/users/${userId}`)
  }
  
  // Handle sorting
  const handleSort = (field: keyof User) => {
    if (sortField === field) {
      // Toggle direction if already sorting by this field
      setSorting(field, sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Default to ascending for new sort field
      setSorting(field, 'asc')
    }
  }
  
  // Get sort icon for column
  const getSortIcon = (field: keyof User) => {
    if (sortField !== field) return null
    
    return sortDirection === 'asc' 
      ? <ChevronUp className="ml-1 h-4 w-4" />
      : <ChevronDown className="ml-1 h-4 w-4" />
  }
  
  // Check if all visible users are selected
  const allSelected = currentUsers.length > 0 && 
    currentUsers.every(user => selectedUsers.includes(user.$id))
  
  // Handle select all checkbox
  const handleSelectAll = () => {
    selectAllUsers(!allSelected)
  }
  
  // Handle bulk actions
  const handleBulkAction = (action: string) => {
    // Implement bulk actions like activate/deactivate, delete, export, etc.
    console.log(`Bulk action: ${action} on users:`, selectedUsers)
  }
  
  // Handle refresh
  const handleRefresh = () => {
    setIsLoading(true)
    // Simulate refresh delay
    setTimeout(() => {
      setIsLoading(false)
    }, 800)
  }
  
  // Generate pagination items
  const getPaginationItems = () => {
    const items = []
    const maxVisible = 5 // Max number of page links to show
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    let endPage = Math.min(totalPages, startPage + maxVisible - 1)
    
    // Adjust if we're near the end
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }
    
    // Add first page if not included
    if (startPage > 1) {
      items.push(
        <PaginationItem key="first">
          <PaginationLink onClick={() => setCurrentPage(1)}>1</PaginationLink>
        </PaginationItem>
      )
      
      // Add ellipsis if there's a gap
      if (startPage > 2) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <span className="px-4">...</span>
          </PaginationItem>
        )
      }
    }
    
    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink 
            onClick={() => setCurrentPage(i)}
            isActive={currentPage === i}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      )
    }
    
    // Add last page if not included
    if (endPage < totalPages) {
      // Add ellipsis if there's a gap
      if (endPage < totalPages - 1) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <span className="px-4">...</span>
          </PaginationItem>
        )
      }
      
      items.push(
        <PaginationItem key="last">
          <PaginationLink onClick={() => setCurrentPage(totalPages)}>
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      )
    }
    
    return items
  }
  
  // If not client-side yet, show skeleton
  if (!isClient) {
    return <UserTableSkeleton />
  }
  
  return (
    <div className="space-y-6">
      <AdminSummary
        badge="User operations"
        title="Member directory"
        description="Administrer rettigheter, roller og campus-tilhørighet i ett samlet overblikk."
        metrics={summaryMetrics.map((metric) => ({
          label: metric.label,
          value: formatMetricValue(metric.value),
          hint: metric.hint,
        }))}
        slot={
          <div className="flex flex-wrap gap-2">
            {quickRoleFilters.map((chip) => {
              const active = filterRole === chip.value
              return (
                <Button
                  key={chip.value}
                  size="sm"
                  variant="ghost"
                  onClick={() => setFilterRole(chip.value)}
                  className={cn(
                    "rounded-full border border-primary/10 bg-white/70 px-3 py-1 text-xs font-semibold text-primary-80 shadow-sm transition",
                    active && "bg-primary-40 text-white shadow-[0_18px_40px_-25px_rgba(0,23,49,0.6)] hover:bg-primary-30 hover:text-white"
                  )}
                >
                  {chip.label}
                </Button>
              )
            })}
          </div>
        }
      />

      <Card className="glass-panel border border-primary/10 shadow-[0_30px_55px_-40px_rgba(0,23,49,0.55)]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-primary-100">User Management</CardTitle>
            <CardDescription className="mt-1.5 text-sm text-primary-60">
              Manage memberships, verify activity, og raffiner tilgangsroller for BISO sine medlemmer.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={handleRefresh}
                    disabled={isLoading}
                    >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh user data</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Button variant="default" className="gap-1.5 rounded-xl bg-primary-40 px-4 py-2 text-white shadow-[0_18px_45px_-30px_rgba(0,23,49,0.7)] hover:bg-primary-30">
              <UserPlus className="h-4 w-4" />
              <span>Add User</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="border-y border-primary/10 bg-white/60 py-4 px-6 backdrop-blur">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-primary-40" />
              <Input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border-primary/20 bg-white/70 pl-9 text-sm shadow-inner focus-visible:ring-primary-40"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-[180px] rounded-xl border-primary/20 bg-white/70">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Roles</SelectLabel>
                    <SelectItem value="all">All Roles</SelectItem>
                    {uniqueRoles.map((roleName) => (
                      <SelectItem key={roleName} value={roleName}>
                        {roleName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1.5 rounded-xl border-primary/20 bg-white/70 text-sm">
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="hidden sm:inline">Filters</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuItem>
                    Active Users
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    Inactive Users
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    Recently Added
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    Clear Filters
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1.5 rounded-xl border-primary/20 bg-white/70 text-sm">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuItem>
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur">
              <div className="animate-pulse flex flex-col items-center">
                <RefreshCw className="animate-spin h-8 w-8 text-primary mb-2" />
                <span className="text-sm text-muted-foreground">Loading users...</span>
              </div>
            </div>
          )}
          
          <div className="relative overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="bg-primary/5">
                  <TableHead className="w-[40px]">
                    <Checkbox 
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all users"
                      className="row-action"
                    />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      <span>User</span>
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center">
                      <span>Email</span>
                      {getSortIcon('email')}
                    </div>
                  </TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('campus')}
                  >
                    <div className="flex items-center">
                      <span>Campus</span>
                      {getSortIcon('campus')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('isActive')}
                  >
                    <div className="flex items-center">
                      <span>Status</span>
                      {getSortIcon('isActive')}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-primary/10">
                <AnimatePresence>
                  {currentUsers.map((user) => (
                    <motion.tr
                      key={user.$id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={(e) => handleRowClick(user.$id, e)}
                      className="group cursor-pointer bg-white/70 transition hover:bg-primary/5"
                    >
                      <TableCell className="w-[40px]">
                        <Checkbox 
                          checked={selectedUsers.includes(user.$id)}
                          onCheckedChange={() => toggleUserSelection(user.$id)}
                          aria-label={`Select ${user.name}`}
                          className="row-action"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} />
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">ID: {user.$id.substring(0, 8)}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-primary-70">{user.email}</TableCell>
                      <TableCell>
                        <RoleBadgeList roles={user.roles} />
                      </TableCell>
                      <TableCell>{user.campus?.name || "—"}</TableCell>
                      <TableCell>
                        <UserStatus isActive={user.isActive} />
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                
                {currentUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Search className="h-8 w-8 mb-2 opacity-50" />
                        <h3 className="font-medium text-lg">No users found</h3>
                        <p className="text-sm">
                          {searchTerm || filterRole !== 'all' 
                            ? "Try adjusting your search or filter criteria" 
                            : "No users have been added yet"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col items-center justify-between gap-4 border-t border-primary/10 bg-white/70 px-6 py-4 sm:flex-row">
        <div className="text-sm text-muted-foreground">
          {selectedUsers.length > 0 ? (
            <div className="flex items-center gap-2">
              <span>
                <strong>{selectedUsers.length}</strong> {selectedUsers.length === 1 ? 'user' : 'users'} selected
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 gap-1.5 text-sm"
                onClick={() => selectAllUsers(false)}
              >
                <span>Clear selection</span>
              </Button>
            </div>
          ) : (
            <span>
              Showing <strong>{indexOfFirstUser + 1}</strong> to <strong>{Math.min(indexOfLastUser, filteredUsers.length)}</strong> of <strong>{filteredUsers.length}</strong> users
            </span>
          )}
        </div>
        
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              />
            </PaginationItem>
            
            {getPaginationItems()}
            
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </CardFooter>
    </Card>
    </div>
  )
}
