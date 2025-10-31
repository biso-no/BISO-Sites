"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import type { Expense } from "@/lib/types/expense"
import { TrendingUp, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react"

export function ExpenseStats({ expenses }: { expenses: Expense[] }) {
  const submittedExpenses = expenses.filter((expense) => expense.status === "submitted")
  const pendingExpenses = expenses.filter((expense) => expense.status === "pending")

  const totalSubmitted = submittedExpenses.reduce((sum, expense) => sum + Number.parseFloat(expense.total), 0)
  const totalPending = pendingExpenses.reduce((sum, expense) => sum + Number.parseFloat(expense.total), 0)

  // Calculate average expense amount
  const avgSubmitted = totalSubmitted / (submittedExpenses.length || 1)
  const avgPending = totalPending / (pendingExpenses.length || 1)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Submitted Expenses"
        value={submittedExpenses.length}
        total={totalSubmitted}
        icon={<TrendingUp className="w-6 h-6" />}
        metric={`${((submittedExpenses.length / (expenses.length || 1)) * 100).toFixed(0)}%`}
        trend="up"
        color="from-blue-500 to-indigo-500"
      />
      <StatCard
        title="Pending Expenses"
        value={pendingExpenses.length}
        total={totalPending}
        icon={<Clock className="w-6 h-6" />}
        metric={`${((pendingExpenses.length / (expenses.length || 1)) * 100).toFixed(0)}%`}
        trend="down"
        color="from-orange-500 to-red-500"
      />
      <StatCard
        title="Avg. Submitted"
        value={avgSubmitted.toFixed(0)}
        total={totalSubmitted}
        icon={<ArrowUpRight className="w-6 h-6" />}
        metric="per expense"
        color="from-emerald-500 to-teal-500"
      />
      <StatCard
        title="Avg. Pending"
        value={avgPending.toFixed(0)}
        total={totalPending}
        icon={<ArrowDownRight className="w-6 h-6" />}
        metric="per expense"
        color="from-purple-500 to-pink-500"
      />
    </div>
  )
}

function StatCard({ 
  title, 
  value, 
  total, 
  icon, 
  metric, 
  trend, 
  color 
}: { 
  title: string
  value: number | string
  total: number
  icon: React.ReactNode
  metric: string
  trend?: 'up' | 'down'
  color: string 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5 }}
      className="group"
    >
      <Card className={`bg-linear-to-br ${color} text-white overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-xl`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium opacity-80">{title}</CardTitle>
            <motion.div 
              initial={{ scale: 0.8 }} 
              animate={{ scale: 1 }}
              className="p-2 bg-white/10 rounded-lg"
            >
              {icon}
            </motion.div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-3xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            <div className="flex items-center justify-between">
              <div className="text-sm opacity-80">Total: ${total.toLocaleString()}</div>
              <div className="flex items-center text-sm">
                {trend && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full ${
                      trend === 'up' ? 'bg-green-400/20' : 'bg-red-400/20'
                    }`}
                  >
                    {metric}
                  </motion.div>
                )}
                {!trend && (
                  <span className="opacity-80">{metric}</span>
                )}
              </div>
            </div>
          </div>
          <motion.div
            className="absolute bottom-0 left-0 w-full h-1 bg-white/20"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
          />
        </CardContent>
      </Card>
    </motion.div>
  )
}

