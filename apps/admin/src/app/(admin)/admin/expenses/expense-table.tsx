"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUpDown, CheckCircle2, Clock, Edit, Loader2, Search } from "lucide-react";

import { Expense } from "@/lib/types/expense";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatPercentage,
  getStatusToken,
  getUniqueLocales,
  parseJSONSafe,
} from "@/lib/utils/admin";
import { AdminSummary } from "@/components/admin/admin-summary";

const TableSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 6 }).map((_, row) => (
      <div key={row} className="flex gap-3">
        {Array.from({ length: 6 }).map((_, cell) => (
          <Skeleton key={cell} className="h-10 flex-1 rounded-xl" />
        ))}
      </div>
    ))}
  </div>
);

const EXPENSE_STATUS_TOKENS = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 border-amber-200" },
  submitted: { label: "Submitted", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Clock,
  submitted: CheckCircle2,
};

const NOK_FORMATTER = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

const StatusBadge = ({ status }: { status: string }) => {
  const token = getStatusToken(status, EXPENSE_STATUS_TOKENS);
  const Icon = STATUS_ICONS[status] ?? CheckCircle2;

  return (
    <Badge className={`flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold uppercase tracking-wide ${token.className}`}>
      <Icon className="h-3 w-3" />
      {token.label}
    </Badge>
  );
};

export function AdminExpenseTable({ expenses }: { expenses: Expense[] }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, setSearchParams] = useState({
    search: "",
    department: "all",
    campus: "all",
    status: "all",
  });
  const [filters, setFilters] = useState(searchParams);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense | null; direction: "asc" | "desc" }>({ key: null, direction: "asc" });

  const uniqueDepartments = useMemo(
    () => Array.from(new Set(expenses.map((expense) => expense.department).filter(Boolean))) as string[],
    [expenses]
  );
  const uniqueCampuses = useMemo(
    () => Array.from(new Set(expenses.map((expense) => expense.campus).filter(Boolean))) as string[],
    [expenses]
  );

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch =
        filters.search === "" || expense.user?.name?.toLowerCase().includes(filters.search.toLowerCase());
      const matchesDepartment = filters.department === "all" || expense.department === filters.department;
      const matchesCampus = filters.campus === "all" || expense.campus === filters.campus;
      const matchesStatus = filters.status === "all" || expense.status === filters.status;
      return matchesSearch && matchesDepartment && matchesCampus && matchesStatus;
    });
  }, [expenses, filters]);

  const sortedExpenses = useMemo(() => {
    const sorted = [...filteredExpenses];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];
        if (aValue === bValue) return 0;
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [filteredExpenses, sortConfig]);

  const stats = useMemo(() => ({
    pending: expenses.filter((expense) => expense.status === "pending").length,
    submitted: expenses.filter((expense) => expense.status === "submitted").length,
    totalAmount: expenses.reduce((sum, expense) => sum + Number(expense.total ?? 0), 0),
    campuses: new Set(expenses.map((expense) => expense.campus)).size,
    departments: new Set(expenses.map((expense) => expense.department)).size,
  }), [expenses]);

  const approvalRate = formatPercentage(stats.submitted, expenses.length);
  const summaryMetrics = [
    { label: "Totalt", value: expenses.length.toLocaleString() },
    { label: "Pending", value: stats.pending.toLocaleString() },
    { label: "Submitted", value: stats.submitted.toLocaleString(), hint: `${approvalRate} godkjent` },
    { label: "Campuser", value: stats.campuses.toString() },
  ]
  const formattedTotal = NOK_FORMATTER.format(stats.totalAmount);

  const handleSort = (key: keyof Expense) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIcon = (key: keyof Expense) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "asc" ? <ArrowUpDown className="h-4 w-4 rotate-180" /> : <ArrowUpDown className="h-4 w-4" />;
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters(searchParams);
  };

  const handleReset = () => {
    const cleared = { search: "", department: "all", campus: "all", status: "all" };
    setSearchParams(cleared);
    setFilters(cleared);
  };

  const actionClick = async (expenseId: string) => {
    setIsLoading(true);
    try {
      await router.push(`/admin/expenses/${expenseId}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <AdminSummary
        badge="Utlegg"
        title="Expense intelligence"
        description="Følg status, campus og volum for innsendte utlegg fra hele organisasjonen."
        metrics={summaryMetrics}
        slot={
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary-70">
            Totalsum {formattedTotal}
          </div>
        }
      />

      <Card className="glass-panel border border-primary/10 shadow-[0_30px_55px_-40px_rgba(0,23,49,0.5)]">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary-100">Filtrer utlegg</CardTitle>
          <CardDescription className="text-sm text-primary-60">
            Avgrens listen etter søker, avdeling, campus og status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="grid gap-3 md:grid-cols-5">
            <Input
              type="text"
              placeholder="Søk på navn..."
              value={searchParams.search}
              onChange={(e) => setSearchParams((prev) => ({ ...prev, search: e.target.value }))}
              className="rounded-xl border-primary/20 bg-white/70 text-sm focus-visible:ring-primary-40 md:col-span-2"
            />
            <Select value={searchParams.department} onValueChange={(value) => setSearchParams((prev) => ({ ...prev, department: value }))}>
              <SelectTrigger className="rounded-xl border-primary/20 bg-white/70 text-sm">
                <SelectValue placeholder="Alle avdelinger" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle avdelinger</SelectItem>
                {uniqueDepartments.map((dep) => (
                  <SelectItem key={dep} value={dep}>
                    {dep || "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={searchParams.campus} onValueChange={(value) => setSearchParams((prev) => ({ ...prev, campus: value }))}>
              <SelectTrigger className="rounded-xl border-primary/20 bg-white/70 text-sm">
                <SelectValue placeholder="Alle campuser" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle campuser</SelectItem>
                {uniqueCampuses.map((campusName) => (
                  <SelectItem key={campusName} value={campusName}>
                    {campusName || "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={searchParams.status} onValueChange={(value) => setSearchParams((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger className="rounded-xl border-primary/20 bg-white/70 text-sm">
                <SelectValue placeholder="Alle statuser" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statuser</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 rounded-xl bg-primary-40 text-sm font-semibold text-white shadow hover:bg-primary-30">
                Filtrer
              </Button>
              <Button type="button" variant="outline" className="rounded-xl border-primary/20 bg-white/70 text-sm" onClick={handleReset}>
                Nullstill
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="glass-panel overflow-hidden rounded-3xl border border-primary/10 bg-white/85 shadow-[0_25px_55px_-38px_rgba(0,23,49,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/10 px-6 py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-primary-100">Utleggsoversikt</h2>
            <p className="text-sm text-primary-60">
              Viser {filteredExpenses.length} av {expenses.length} registrerte utlegg
            </p>
          </div>
          <Badge variant="outline" className="rounded-full border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary-70">
            {approvalRate} godkjent
          </Badge>
        </div>
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur">
              <Loader2 className="h-6 w-6 animate-spin text-primary-80" />
            </div>
          )}
          <div className="overflow-x-auto">
            <Table className="min-w-[760px] text-sm">
              <TableHeader>
                <TableRow className="bg-primary/5">
                  <TableHead className="w-[200px] cursor-pointer" onClick={() => handleSort("user")}>
                    <div className="flex items-center gap-2">
                      Navn
                      {getSortIcon("user")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("department")}>
                    Avdeling
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("campus")}>
                    Campus
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("category")}>
                    Kategori
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("total")}>
                    Beløp
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>
                    Status
                  </TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-primary/10">
                <AnimatePresence>
                  {(isLoading ? [] : sortedExpenses).map((expense) => (
                    <motion.tr
                      key={expense.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                      className="bg-white/70 transition hover:bg-primary/5"
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary-80">
                            {expense.user?.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span>{expense.user?.name}</span>
                            <span className="text-xs text-primary-50">{expense.user?.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{expense.department || "—"}</TableCell>
                      <TableCell>{expense.campus || "—"}</TableCell>
                      <TableCell>{expense.category || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full border-primary/20 px-3 py-0.5 font-mono text-xs text-primary-80">
                          {expense.total ? NOK_FORMATTER.format(Number(expense.total)) : "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={expense.status || "pending"} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-full px-3 py-1 text-xs font-semibold text-primary-80 hover:bg-primary/10"
                          onClick={() => actionClick(expense.id)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Se detalj
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
          {!sortedExpenses.length && !isLoading && (
            <div className="flex flex-col items-center justify-center gap-2 border-t border-dashed border-primary/10 px-6 py-10 text-sm text-primary-60">
              <Search className="h-6 w-6" />
              Ingen utlegg matcher filtrene dine.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
