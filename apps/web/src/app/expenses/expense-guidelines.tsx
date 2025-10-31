"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { Button } from "@repo/ui/components/ui/button"
import { ChevronDown, ChevronUp, Info } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs"

export function ExpenseGuidelines() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card className="shadow-md border-blue-100 overflow-hidden">
      <CardHeader className="bg-linear-to-r from-blue-50 to-indigo-50 pb-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-blue-700">Expense Submission Guidelines</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-100/50"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Hide Guidelines
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                View Guidelines
              </>
            )}
          </Button>
        </div>
        <CardDescription>
          Please review these guidelines before submitting expense reimbursements
        </CardDescription>
      </CardHeader>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CardContent className="pt-4">
              <Tabs defaultValue="guidelines">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
                  <TabsTrigger value="requirements">Requirements</TabsTrigger>
                  <TabsTrigger value="purpose">Purpose Details</TabsTrigger>
                </TabsList>
                <TabsContent value="guidelines" className="mt-4 space-y-4">
                  <h3 className="font-semibold text-lg text-blue-700">Submission Process</h3>
                  <ul className="space-y-2 list-disc pl-5">
                    <li>Fill in all required information in the form (make sure to describe the purpose carefully).</li>
                    <li>Drag and drop to upload multiple files at once. There is no limit to the number of attachments you can upload.</li>
                    <li>If the payment confirmation is a separate document, add this as a separate attachment and set the amount to 0.</li>
                    <li>A new page is generated for each attachment. Input description, date and amount for the receipt, upload the receipt and click next.</li>
                    <li>Confirm the reimbursement total on the last page, and add additional comments if necessary.</li>
                    <li>Tick the box for sign and confirm and submit the form.</li>
                  </ul>
                  <p className="text-sm text-gray-600 mt-4">
                    You will receive a confirmation e-mail with a copy of the reimbursement shortly after submission.
                  </p>
                  <p className="text-sm text-gray-600">
                    You can fill in the form in either Norwegian or English.
                  </p>
                </TabsContent>
                <TabsContent value="requirements" className="mt-4 space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg text-blue-700">General Requirements</h3>
                    <ul className="space-y-2 list-disc pl-5 mt-2">
                      <li>Make sure your expenses are approved in advance by the President or Financial Controller in your BISO unit</li>
                      <li>All reimbursements must be documented with digital or scanned copies of the original receipt (a bank statement is not enough!)</li>
                      <li>The purpose of the reimbursement must be described clearly</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-blue-700">Receipt Requirements</h3>
                    <ul className="space-y-2 list-disc pl-5 mt-2">
                      <li>What was purchased, at what price and quantity (the payment basis)</li>
                      <li>A confirmation that the expenses has been paid (the payment confirmation)</li>
                      <li>Specified MVA (value added tax)</li>
                    </ul>
                  </div>
                  <p className="text-sm italic mt-2">
                    Note: It is your responsibility to store the original documents for possible clarification purposes until you have received payment.
                  </p>
                </TabsContent>
                <TabsContent value="purpose" className="mt-4 space-y-4">
                  <h3 className="font-semibold text-lg text-blue-700">Purpose Description</h3>
                  <p className="mb-2">
                    It is very important that the purpose of the expenses is described correctly.
                  </p>
                  <ul className="space-y-2 list-disc pl-5">
                    <li>What is the reimbursement (ex: food)</li>
                    <li>What activity is the reimbursement regarding (ex: social gathering during business presentation)</li>
                    <li>Is the reimbursement in context with an activity that generates income (ex: paid by Nordea)</li>
                  </ul>
                  <div className="bg-blue-50 p-4 rounded-md mt-4">
                    <p className="font-medium">Example:</p>
                    <p className="italic">&ldquo;Food for social Christmas event with all board members&rdquo;</p>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-md border border-amber-200 mt-2">
                    <p className="font-medium text-amber-800">Important:</p>
                    <p className="text-amber-700">If the requirements are not met, the reimbursement will not be approved.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
} 