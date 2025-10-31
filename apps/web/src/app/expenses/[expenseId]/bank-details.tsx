"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { motion } from "framer-motion";
import { CreditCard, Building2, User } from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { useFormContext } from "./formContext";
import { bankDetailsSchema } from "./zodSchemas";

const formVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.5,
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.3
    }
  }
};

export function BankDetailsStep() {
  const { formData, updateFormData, updateStep } = useFormContext();

  const form = useForm<z.infer<typeof bankDetailsSchema>>({
    resolver: zodResolver(bankDetailsSchema),
    defaultValues: {
      bank_account: formData.bank_account || "",
      account_holder: formData.account_holder || "",
      bank_name: formData.bank_name || "",
      swift_code: formData.swift_code || "",
    },
  });

  const onSubmit = async (values: z.infer<typeof bankDetailsSchema>) => {
    updateFormData(values);
    updateStep(2);
  };

  return (
    <motion.div
      variants={formVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bank Account Number */}
            <motion.div variants={itemVariants} className="col-span-2">
              <FormField
                control={form.control}
                name="bank_account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-2">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <span>Bank Account Number</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your bank account number"
                        className="font-mono"
                      />
                    </FormControl>
                    <FormDescription>
                      Your full bank account number for receiving reimbursements
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            {/* Account Holder */}
            <motion.div variants={itemVariants}>
              <FormField
                control={form.control}
                name="account_holder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-blue-600" />
                      <span>Account Holder</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Full name on account"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            {/* Bank Name */}
            <motion.div variants={itemVariants}>
              <FormField
                control={form.control}
                name="bank_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>Bank Name</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your bank name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            {/* SWIFT/BIC Code */}
            <motion.div variants={itemVariants} className="col-span-2">
              <FormField
                control={form.control}
                name="swift_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-2">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <span>SWIFT/BIC Code</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter SWIFT/BIC code"
                        className="font-mono uppercase"
                      />
                    </FormControl>
                    <FormDescription>
                      International bank identifier code (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>
          </div>

          <motion.div
            variants={itemVariants}
            className="flex justify-end pt-4"
          >
            <Button
              type="submit"
              className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8"
            >
              Next Step
            </Button>
          </motion.div>
        </form>
      </Form>
    </motion.div>
  );
}
