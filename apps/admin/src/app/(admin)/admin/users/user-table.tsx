"use client";

import type { Users } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { AdminSummary } from "@/components/admin/admin-summary";
import { cn } from "@/lib/utils";
import { formatPercentage } from "@/lib/utils/admin";
import { RoleBadgeList } from "./role-badge";
import { UserAvatar } from "./user-avatar";
import { UserStatus } from "./user-status";
import { useUserStore } from "./user-store";
import { UserTableSkeleton } from "./user-table-skeleton";

export function UserTable({ initialUsers }: { initialUsers: Users[] }) {
  const t = useTranslations("adminUsers");
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

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
    setIsLoading,
  } = useUserStore();

  // Initialize store with users on component mount
  useEffect(() => {
    setUsers(initialUsers);
    setIsClient(true);
  }, [initialUsers, setUsers]);

  // Get current page of users
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);

  const totalCount = filteredUsers.length;
  const activeCount = useMemo(
    () => filteredUsers.filter((user) => user.isActive).length,
    [filteredUsers]
  );
  const inactiveCount = useMemo(
    () => filteredUsers.filter((user) => !user.isActive).length,
    [filteredUsers]
  );
  const rosterSource = users.length ? users : initialUsers;
  const activeRate = formatPercentage(activeCount, totalCount || 0);

  const uniqueRoles = useMemo(
    () =>
      Array.from(
        new Set(
          rosterSource.flatMap((user) =>
            Array.isArray(user.roles) ? user.roles : []
          )
        )
      ),
    [rosterSource]
  );
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
  );

  const summaryMetrics = [
    {
      label: t("table.name"),
      value: totalCount,
      hint: `${selectedUsers.length} ${t("filters.search")}`,
    },
    {
      label: t("filters.active"),
      value: activeCount,
      hint: `${activeRate} ${t("filters.active").toLowerCase()}`,
    },
    { label: t("filters.inactive"), value: inactiveCount },
    { label: t("metrics.campuses"), value: uniqueCampuses.length },
  ];

  const formatMetricValue = (value: number | string) =>
    typeof value === "number" ? value.toLocaleString() : value;

  const quickRoleFilters = useMemo(() => {
    const roleEntries = uniqueRoles.slice(0, 4).map((roleName) => ({
      label: roleName,
      value: roleName,
    }));
    return [{ label: t("filters.all"), value: "all" }, ...roleEntries];
  }, [uniqueRoles, t]);

  // Handle row click to navigate to user detail
  const handleRowClick = (userId: string, e: React.MouseEvent) => {
    // Don't navigate if clicking on checkbox or action buttons
    if ((e.target as HTMLElement).closest(".row-action")) {
      return;
    }
    router.push(`/admin/users/${userId}`);
  };

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if already sorting by this field
      setSorting(field, sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Default to ascending for new sort field
      setSorting(field, "asc");
    }
  };

  // Get sort icon for column
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return null;
    }

    return sortDirection === "asc" ? (
      <ChevronUp className="ml-1 h-4 w-4" />
    ) : (
      <ChevronDown className="ml-1 h-4 w-4" />
    );
  };

  // Check if all visible users are selected
  const allSelected =
    currentUsers.length > 0 &&
    currentUsers.every((user) => selectedUsers.includes(user.$id));

  // Handle select all checkbox
  const handleSelectAll = () => {
    selectAllUsers(!allSelected);
  };

  // Handle bulk actions
  const _handleBulkAction = (action: string) => {
    // Implement bulk actions like activate/deactivate, delete, export, etc.
    console.log(`Bulk action: ${action} on users:`, selectedUsers);
  };

  // Handle refresh
  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate refresh delay
    setTimeout(() => {
      setIsLoading(false);
    }, 800);
  };

  // Generate pagination items
  const getPaginationItems = () => {
    const items = [];
    const maxVisible = 5; // Max number of page links to show

    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);

    // Adjust if we're near the end
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    // Add first page if not included
    if (startPage > 1) {
      items.push(
        <PaginationItem key="first">
          <PaginationLink onClick={() => setCurrentPage(1)}>1</PaginationLink>
        </PaginationItem>
      );

      // Add ellipsis if there's a gap
      if (startPage > 2) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <span className="px-4">...</span>
          </PaginationItem>
        );
      }
    }

    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            isActive={currentPage === i}
            onClick={() => setCurrentPage(i)}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    // Add last page if not included
    if (endPage < totalPages) {
      // Add ellipsis if there's a gap
      if (endPage < totalPages - 1) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <span className="px-4">...</span>
          </PaginationItem>
        );
      }

      items.push(
        <PaginationItem key="last">
          <PaginationLink onClick={() => setCurrentPage(totalPages)}>
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  // If not client-side yet, show skeleton
  if (!isClient) {
    return <UserTableSkeleton />;
  }

  const selectionText = t("messages.usersSelected", {
    count: selectedUsers.length,
    plural: selectedUsers.length === 1 ? "" : "s",
  });
  const showingText = t("messages.showingRange", {
    start: indexOfFirstUser + 1,
    end: Math.min(indexOfLastUser, filteredUsers.length),
    total: filteredUsers.length,
  });

  return (
    <div className="space-y-6">
      <AdminSummary
        badge={t("title")}
        description={t("description")}
        metrics={summaryMetrics.map((metric) => ({
          label: metric.label,
          value: formatMetricValue(metric.value),
          hint: metric.hint,
        }))}
        slot={
          <div className="flex flex-wrap gap-2">
            {quickRoleFilters.map((chip) => {
              const active = filterRole === chip.value;
              return (
                <Button
                  className={cn(
                    "rounded-full border border-primary/10 px-3 py-1 font-semibold text-primary-80 text-xs shadow-sm transition",
                    active &&
                      "bg-primary-40 text-white shadow-[0_18px_40px_-25px_rgba(0,23,49,0.6)] hover:bg-primary-30 hover:text-white"
                  )}
                  key={chip.value}
                  onClick={() => setFilterRole(chip.value)}
                  size="sm"
                  variant="ghost"
                >
                  {chip.label}
                </Button>
              );
            })}
          </div>
        }
        title={t("title")}
      />

      <Card className="glass-panel border border-primary/10 shadow-[0_30px_55px_-40px_rgba(0,23,49,0.55)]">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="font-semibold text-primary-100 text-xl">
                {t("title")}
              </CardTitle>
              <CardDescription className="mt-1.5 text-primary-60 text-sm">
                {t("description")}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      disabled={isLoading}
                      onClick={handleRefresh}
                      size="icon"
                      variant="outline"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("messages.loading")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                className="gap-1.5 rounded-xl bg-primary-40 px-4 py-2 text-white shadow-[0_18px_45px_-30px_rgba(0,23,49,0.7)] hover:bg-primary-30"
                variant="default"
              >
                <UserPlus className="h-4 w-4" />
                <span>{t("form.create")}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="border-primary/10 border-y px-6 py-4 backdrop-blur">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-primary-40" />
                <Input
                  className="w-full rounded-xl border-primary/20 pl-9 text-sm shadow-inner focus-visible:ring-primary-40"
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t("filters.search")}
                  type="text"
                  value={searchTerm}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select onValueChange={setFilterRole} value={filterRole}>
                  <SelectTrigger className="w-[180px] rounded-xl border-primary/20">
                    <SelectValue placeholder={t("filters.role")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>{t("table.roles")}</SelectLabel>
                      <SelectItem value="all">{t("filters.all")}</SelectItem>
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
                    <Button
                      className="gap-1.5 rounded-xl border-primary/20text-sm"
                      variant="outline"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {t("filters.role")}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuItem>{t("filters.active")}</DropdownMenuItem>
                    <DropdownMenuItem>{t("filters.inactive")}</DropdownMenuItem>
                    <DropdownMenuItem>
                      {t("table.registeredAt")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>{t("filters.all")}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="gap-1.5 rounded-xl border-primary/20 text-sm"
                      variant="outline"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {t("actions.view")}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuItem>
                      {t("actions.exportCsv")}
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      {t("actions.exportExcel")}
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      {t("actions.exportPdf")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur">
                <div className="flex animate-pulse flex-col items-center">
                  <RefreshCw className="mb-2 h-8 w-8 animate-spin text-primary" />
                  <span className="text-muted-foreground text-sm">
                    {t("messages.loading")}
                  </span>
                </div>
              </div>
            )}

            <div className="relative overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="bg-primary/5">
                    <TableHead className="w-[40px]">
                      <Checkbox
                        aria-label={t("labels.selectAllUsers")}
                        checked={allSelected}
                        className="row-action"
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center">
                        <span>{t("table.name")}</span>
                        {getSortIcon("name")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("email")}
                    >
                      <div className="flex items-center">
                        <span>{t("table.email")}</span>
                        {getSortIcon("email")}
                      </div>
                    </TableHead>
                    <TableHead>{t("table.roles")}</TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("campus")}
                    >
                      <div className="flex items-center">
                        <span>{t("filters.campus")}</span>
                        {getSortIcon("campus")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("isActive")}
                    >
                      <div className="flex items-center">
                        <span>{t("table.status")}</span>
                        {getSortIcon("isActive")}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-primary/10">
                  <AnimatePresence>
                    {currentUsers.map((user) => (
                      <motion.tr
                        animate={{ opacity: 1, y: 0 }}
                        className="group cursor-pointerbg-white/70 transition hover:bg-primary/5"
                        exit={{ opacity: 0 }}
                        initial={{ opacity: 0, y: 10 }}
                        key={user.$id}
                        onClick={(e) => handleRowClick(user.$id, e)}
                        transition={{ duration: 0.2 }}
                      >
                        <TableCell className="w-[40px]">
                          <Checkbox
                            aria-label={`Select ${user.name}`}
                            checked={selectedUsers.includes(user.$id)}
                            className="row-action"
                            onCheckedChange={() =>
                              toggleUserSelection(user.$id)
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <UserAvatar user={user} />
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-muted-foreground text-sm">
                                ID: {user.$id.substring(0, 8)}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-primary-70 text-xs">
                          {user.email}
                        </TableCell>
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
                      <TableCell className="h-32 text-center" colSpan={6}>
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Search className="mb-2 h-8 w-8 opacity-50" />
                          <h3 className="font-medium text-lg">
                            {t("messages.noUsers")}
                          </h3>
                          <p className="text-sm">
                            {searchTerm || filterRole !== "all"
                              ? t("messages.adjustFilters")
                              : t("messages.noUsersYet")}
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

        <CardFooter className="flex flex-col items-center justify-between gap-4 border-primary/10 border-t px-6 py-4 sm:flex-row">
          <div className="text-muted-foreground text-sm">
            {selectedUsers.length > 0 ? (
              <div className="flex items-center gap-2">
                <span>{selectionText}</span>
                <Button
                  className="h-8 gap-1.5 text-sm"
                  onClick={() => selectAllUsers(false)}
                  size="sm"
                  variant="ghost"
                >
                  <span>{t("messages.clearSelection")}</span>
                </Button>
              </div>
            ) : (
              <span>{showingText}</span>
            )}
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                />
              </PaginationItem>

              {getPaginationItems()}

              <PaginationItem>
                <PaginationNext
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardFooter>
      </Card>
    </div>
  );
}
