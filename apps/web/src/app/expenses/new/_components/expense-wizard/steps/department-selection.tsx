"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@repo/ui/components/ui/button"
import { Switch } from "@repo/ui/components/ui/switch"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select"
import {
  Building,
  GraduationCap,
  CalendarDays,
} from "lucide-react"
import { Input } from "@repo/ui/components/ui/input"
import { useAuth } from "@/lib/hooks/useAuth"
import { useAppContext } from "@/app/contexts"

const formSchema = z.object({
  campus: z.string().min(1, "Please select a campus"),
  department: z.string().min(1, "Please select a department"),
  isEventExpense: z.boolean().default(false),
  eventName: z.string().optional().or(z.literal("")).transform(val => val || undefined),
})

type FormValues = z.infer<typeof formSchema>

interface DepartmentSelectionProps {
  onNext: () => void
  onPrevious: () => void
  data: any
  onUpdate: (data: any) => void
}

export function DepartmentSelection({
  onNext,
  onPrevious,
  data,
  onUpdate,
}: DepartmentSelectionProps) {
  const { profile } = useAuth()
  const { campuses } = useAppContext()
  
  const defaultCampus = data?.campus || profile?.campus_id || ""
  const [selectedCampus, setSelectedCampus] = useState<string>(defaultCampus)

  const getSelectedCampusDepartments = () => {
    const campus = campuses.find((c) => c.$id === selectedCampus)
    return campus?.departments || []
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      campus: defaultCampus,
      department: data?.department || profile?.department_ids?.[0] || "",
      isEventExpense: data?.isEventExpense || false,
      eventName: data?.eventName || "",
    },
  })

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "campus") {
        setSelectedCampus(value.campus || "")
      }
    })
    return () => subscription.unsubscribe()
  }, [form, form.watch])

  const onSubmit = (values: FormValues) => {
    onUpdate(values)
    onNext()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Location & Department</CardTitle>
            <CardDescription>
              Select your campus and department for this expense claim.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <motion.div
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <FormField
                control={form.control}
                name="campus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-blue-500" />
                      Campus
                    </FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value)
                        setSelectedCampus(value)
                        form.setValue("department", "")
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a campus" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {campuses.map((campus) => (
                          <SelectItem key={campus.$id} value={campus.$id}>
                            {campus.name}
                          </SelectItem>
                        ))}

                      </SelectContent>
                    </Select>
                    <FormMessage />

                  </FormItem>
                )}
              />
            </motion.div>

            <motion.div
              animate={{ opacity: selectedCampus ? 1 : 0.5 }}
              transition={{ duration: 0.2 }}
            >
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-blue-500" />
                      Department
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={!selectedCampus}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getSelectedCampusDepartments().map((department) => (
                          <SelectItem key={department.$id} value={department.$id}>
                            {department.Name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                name="isEventExpense"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-blue-500" />
                        Related to an event
                      </FormLabel>
                      <FormDescription>
                        Enable if this expense is related to a specific event. (Used by AI if activated to suggest proper description)
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

            {form.watch("isEventExpense") && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <FormField
                  control={form.control}
                  name="eventName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-blue-500" />
                        Event Name
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter the event name" />
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