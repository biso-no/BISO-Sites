"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@repo/ui/components/ui/button"
import { Input } from "@repo/ui/components/ui/input"
import { Textarea } from "@repo/ui/components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@repo/ui/components/ui/form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card"
import { FileText, StickyNote, Loader2 } from "lucide-react"
import { Switch } from "@repo/ui/components/ui/switch"
import { Label } from "@repo/ui/components/ui/label"

const formSchema = z.object({
  description: z.string().min(1, "Description is required"),
  additionalNotes: z.string().optional(),
  hasPrepayment: z.boolean().default(false),
  prepaymentAmount: z.number().optional()
    .refine(val => !val || val >= 0, "Prepayment amount must be positive")
})

type FormValues = z.infer<typeof formSchema>

interface ExpenseDescriptionProps {
  onNext: () => void
  onPrevious: () => void
  data: {
    documents?: Array<{
      description: string;
      amount: number;
      date: string;
    }>;
    generatedDescription?: string | null;
    aiEnabled?: boolean;
    hasPrepayment?: boolean;
    prepaymentAmount?: number;
  }
  onUpdate: (data: any) => void
}

export function ExpenseDescription({
  onNext,
  onPrevious,
  data,
  onUpdate,
}: ExpenseDescriptionProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [prevDocumentsCount, setPrevDocumentsCount] = useState(data?.rows?.length || 0);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: data?.generatedDescription || "",
      additionalNotes: "",
      hasPrepayment: data?.hasPrepayment || false,
      prepaymentAmount: data?.prepaymentAmount || 0,
    },
  })

  useEffect(() => {
    // Only update if the number of documents has changed or we're in the generating state
    const docsChanged = prevDocumentsCount !== (data?.rows?.length || 0);
    
    if (data?.rows?.length) {
      // If AI is generating a description (null state)
      if (data.generatedDescription === null && data.aiEnabled) {
        setIsGenerating(true);
        form.setValue('description', 'Generating description...');
      } 
      // If we have a generated description from AI
      else if (data.generatedDescription && data.aiEnabled) {
        setIsGenerating(false);
        form.setValue('description', data.generatedDescription);
      } 
      // If AI is not enabled or we need to generate a default description
      else if (!data.generatedDescription || docsChanged || !data.aiEnabled) {
        setIsGenerating(false);
        // Only update the default description if we don't have one or if documents changed
        if (docsChanged || !form.getValues('description')) {
          const totalAmount = data.rows.reduce((sum, doc) => sum + doc.amount, 0);
          const description = `Expense claim for ${data.rows.length} document${
            data.rows.length > 1 ? 's' : ''
          } totaling ${totalAmount.toFixed(2)} NOK`;
          form.setValue('description', description);
        }
      }
      
      // Update the document count tracker
      setPrevDocumentsCount(data?.rows?.length || 0);
    }
  }, [data, form, prevDocumentsCount]);

  // Add debug logging to see what's happening
  useEffect(() => {
    console.log('Current form values:', form.getValues());
  }, [form]);

  const onSubmit = (values: FormValues) => {
    // Preserve aiEnabled when updating
    onUpdate({
      ...values,
      aiEnabled: data?.aiEnabled
    });
    onNext();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Expense Details</CardTitle>
            <CardDescription>
              Review and finalize your expense description
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <motion.div
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      Description
                    </FormLabel>
                    <FormDescription>
                      A clear description of your expense claim
                    </FormDescription>
                    <FormControl>
                      {isGenerating ? (
                        <div className="relative">
                          <Input 
                            {...field} 
                            className="font-medium bg-gray-50" 
                            disabled
                          />
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-gray-50/80">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            <span className="text-sm text-gray-600">
                              Generating description...
                            </span>
                          </div>
                        </div>
                      ) : (
                        <Input {...field} className="font-medium" />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            <motion.div
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.1 }}
            >
              <FormField
                control={form.control}
                name="additionalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <StickyNote className="w-4 h-4 text-blue-500" />
                      Additional Notes
                    </FormLabel>
                    <FormDescription>
                      Any additional information or context for this expense claim
                    </FormDescription>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Add any additional notes or context here..."
                        className="min-h-[100px] resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            <motion.div
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <FormField
                control={form.control}
                name="hasPrepayment"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Prepayment Received</FormLabel>
                      <FormDescription>
                        Enable if you received money in advance for this expense
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </motion.div>

            {form.watch("hasPrepayment") && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <FormField
                  control={form.control}
                  name="prepaymentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prepayment Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Enter prepayment amount"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onPrevious}
          >
            Previous
          </Button>
          <Button
            type="submit"
            className="bg-linear-to-r from-blue-500 to-indigo-500 text-white px-8"
          >
            Continue
          </Button>
        </div>
      </form>
    </Form>
  )
} 