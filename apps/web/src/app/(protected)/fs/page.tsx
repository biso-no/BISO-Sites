import { ImageWithFallback } from "@repo/ui/components/image";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ExpenseCard } from "@/components/expense/expense-card";
import { ExpenseListSkeleton } from "@/components/expense/expense-skeleton";
import { getExpenses } from "@/lib/actions/expense";

async function ExpenseList() {
  const result = await getExpenses();

  if (!result.success) {
    return (
      <Card className="border-0 p-12 text-center shadow-lg">
        <p className="mb-4 text-red-600">Failed to load expenses</p>
        <p className="text-muted-foreground">{result.error}</p>
      </Card>
    );
  }

  if (result.expenses.length === 0) {
    return (
      <Card className="border-0 p-12 text-center shadow-lg">
        <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
        <h3 className="mb-2 font-semibold text-foreground text-xl">
          No reimbursements yet
        </h3>
        <p className="mb-6 text-muted-foreground">
          Submit your first reimbursement to get started
        </p>
        <Link href="/fs/new">
          <Button className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90">
            <Plus className="mr-2 h-5 w-5" />
            Submit New Reimbursement
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      {result.expenses.map((expense, index) => (
        <ExpenseCard expense={expense} index={index} key={expense.$id} />
      ))}
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      {/* Hero Section */}
      <div className="relative h-[50vh] overflow-hidden">
        <ImageWithFallback
          alt="Reimbursements"
          className="object-cover"
          fill
          src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNlJTIwcmVpbWJ1cnNlbWVudHxlbnwxfHx8fDE3NjIxNjUxNDV8MA&ixlib=rb-4.1.0&q=80&w=1080"
        />
        <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <h1 className="mb-6 font-bold text-5xl text-white">
              Reimbursements
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-white/90">
              Submit and track your expense reimbursements. Get reimbursed for
              approved expenses quickly and easily.
            </p>
            <Link href="/fs/new">
              <Button
                className="bg-background text-brand-dark hover:bg-background/90"
                size="lg"
              >
                <Plus className="mr-2 h-5 w-5" />
                Submit New Reimbursement
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Reimbursements List */}
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8">
          <h2 className="mb-2 font-bold text-3xl text-foreground">
            Your Reimbursements
          </h2>
          <p className="text-muted-foreground">
            Track the status of your submitted reimbursements
          </p>
        </div>

        <Suspense fallback={<ExpenseListSkeleton />}>
          <ExpenseList />
        </Suspense>
      </div>
    </div>
  );
}
