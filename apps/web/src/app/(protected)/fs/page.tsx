import { Suspense } from "react";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ImageWithFallback } from "@repo/ui/components/image";
import { getExpenses } from "@/lib/actions/expense";
import { ExpenseCard } from "@/components/expense/expense-card";
import { ExpenseListSkeleton } from "@/components/expense/expense-skeleton";

async function ExpenseList() {
  const result = await getExpenses();

  if (!result.success) {
    return (
      <Card className="p-12 text-center border-0 shadow-lg">
        <p className="text-red-600 mb-4">Failed to load expenses</p>
        <p className="text-gray-600">{result.error}</p>
      </Card>
      );
  }

  if (result.expenses.length === 0) {
    return (
      <Card className="p-12 text-center border-0 shadow-lg">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No reimbursements yet
        </h3>
        <p className="text-gray-600 mb-6">
          Submit your first reimbursement to get started
        </p>
        <Link href="/fs/new">
          <Button className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white">
            <Plus className="w-5 h-5 mr-2" />
            Submit New Reimbursement
                        </Button>
        </Link>
                </Card>
    );
  }

  return (
    <div className="grid gap-6">
      {result.expenses.map((expense, index) => (
        <ExpenseCard key={expense.$id} expense={expense} index={index} />
      ))}
      </div>
    );
  }

export default function ExpensesPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="relative h-[50vh] overflow-hidden">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNlJTIwcmVpbWJ1cnNlbWVudHxlbnwxfHx8fDE3NjIxNjUxNDV8MA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Reimbursements"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h1 className="mb-6 text-5xl font-bold text-white">Reimbursements</h1>
            <p className="text-white/90 text-lg max-w-2xl mx-auto mb-8">
              Submit and track your expense reimbursements. Get reimbursed for approved
              expenses quickly and easily.
              </p>
            <Link href="/fs/new">
              <Button
                className="bg-white text-[#001731] hover:bg-white/90"
                size="lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                Submit New Reimbursement
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Reimbursements List */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Your Reimbursements
          </h2>
          <p className="text-gray-600">
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
