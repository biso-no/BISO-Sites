"use client"
import React, { useState } from 'react';
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Eye, Plus, Send, TrendingUp, Clock, Search, Filter, User } from 'lucide-react';
import { useRouter } from "next/navigation";
import { updateExpenseStatus } from "@/app/actions/admin";
import { Expense } from "@/lib/types/expense";
import { Input } from "@repo/ui/components/ui/input";
import { reSubmitExpense } from '@/app/actions/expense';

const tableVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.6,
      ease: "easeOut"
    }
  }
};

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4
    }
  })
};

export function ExpenseTable({ expenses }: { expenses: Expense[] }) {
  const [activeTab, setActiveTab] = useState<'submitted' | 'pending'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const filteredExpenses = expenses.filter(expense => 
    expense.status === activeTab &&
    (searchTerm === '' || 
     expense.total.toString().includes(searchTerm) ||
     format(new Date(expense.$createdAt), "dd MMM yyyy").toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a, b) => {
    const dateA = new Date(a.$createdAt).getTime();
    const dateB = new Date(b.$createdAt).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const submittedExpenses = expenses.filter(expense => expense.status === "submitted");
  const pendingExpenses = expenses.filter(expense => expense.status === "pending");
  const router = useRouter();

  const handleViewExpense = (id: string) => {
    router.push(`expenses/view/${id}`);
  };

  const onSubmitExpense = async (id: string) => {
    await reSubmitExpense(id);
    // Add visual feedback here
  };

  const handleAddExpense = () => {
    router.push("../expenses/new");
  };

  const handleGoToProfile = () => {
    router.push("../expenses/profile");
  };

  const StatusIndicator = ({ status }: { status: string }) => (
    <motion.span
      initial={{ scale: 0.8 }}
      animate={{ scale: 1 }}
      className={`
        inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
        ${status === "submitted" 
          ? "bg-green-50 text-green-700 border border-green-200" 
          : "bg-amber-50 text-amber-700 border border-amber-200"}
      `}
    >
      {status === "submitted" ? (
        <TrendingUp className="w-3 h-3 mr-1" />
      ) : (
        <Clock className="w-3 h-3 mr-1" />
      )}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </motion.span>
  );

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      <div className="container mx-auto p-6 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-indigo-600">
            Expenses Dashboard
          </h1>
          <div className="flex gap-3">
            <Button 
              onClick={handleAddExpense}
              className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 group"
            >
              <Plus className="h-4 mr-2 group-hover:rotate-90 transition-transform duration-200" />
              Add New Expense
            </Button>
          </div>
        </motion.div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex space-x-2 w-full md:w-auto">
            <Button
              variant={activeTab === 'pending' ? 'default' : 'outline'}
              onClick={() => setActiveTab('pending')}
              className={`flex-1 md:flex-none ${
                activeTab === 'pending' 
                  ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white' 
                  : ''
              }`}
            >
              <Clock className="w-4 h-4 mr-2" />
              Pending
            </Button>
            <Button
              variant={activeTab === 'submitted' ? 'default' : 'outline'}
              onClick={() => setActiveTab('submitted')}
              className={`flex-1 md:flex-none ${
                activeTab === 'submitted' 
                  ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white' 
                  : ''
              }`}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Submitted
            </Button>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="gap-2"
            >
              <Filter className={`w-4 h-4 transition-transform duration-200 ${
                sortOrder === 'desc' ? 'rotate-180' : ''
              }`} />
              Date
            </Button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={tableVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Amount</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-gray-500">
                      No expenses found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((expense, i) => (
                    <motion.tr
                      key={expense.id}
                      variants={rowVariants}
                      initial="hidden"
                      animate="visible"
                      custom={i}
                      className="group hover:bg-blue-50/50 transition-colors duration-200"
                    >
                      <TableCell className="font-medium">
                        {format(new Date(expense.$createdAt), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="font-semibold">
                        <span className="text-blue-600">{expense.total} kr</span>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={expense.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewExpense(expense.$id)}
                            className="hover:bg-blue-100/50 hover:text-blue-700 transition-colors"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                          {expense.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onSubmitExpense(expense.$id)}
                              className="hover:bg-green-100/50 hover:text-green-700 transition-colors"
                            >
                              <Send className="w-4 h-4 mr-2" />
                              Submit
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ExpenseTable;