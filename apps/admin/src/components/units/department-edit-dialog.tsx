"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Department, updateDepartment, createDepartment } from "@/lib/admin/departments";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { Switch } from "@repo/ui/components/ui/switch";
import { Label } from "@repo/ui/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import { toast } from "@repo/ui/components/ui/use-toast";
import { Loader2 } from "lucide-react";

const departmentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  campus_id: z.string().min(1, "Campus is required"),
  type: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  active: z.boolean().default(true),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

interface DepartmentEditDialogProps {
  department?: Department;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  campuses: Array<{ id: string; name: string }>;
  types: string[];
}

export function DepartmentEditDialog({
  department,
  open,
  onOpenChange,
  onSuccess,
  campuses,
  types,
}: DepartmentEditDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCreating = !department;
  
  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: department?.name || "",
      campus_id: department?.campus_id || "",
      type: department?.type || "none",
      description: department?.description || "",
      logo: department?.logo || "",
      active: department?.active ?? true,
    },
  });
  
  async function onSubmit(values: DepartmentFormValues) {
    setIsSubmitting(true);
    
    try {
      if (isCreating) {
        // Ensure required fields are present for create operation
        const departmentData = {
          name: values.name,
          campus_id: values.campus_id,
          type: values.type === "none" ? "" : values.type || "",
          description: values.description || "",
          logo: values.logo || "",
          active: values.active
        };
        
        await createDepartment(departmentData);
        toast({
          title: "Department created",
          description: `${values.name} has been successfully created.`,
        });
      } else if (department) {
        // Convert "none" back to empty string for API
        const updatedValues = {
          ...values,
          type: values.type === "none" ? "" : values.type
        };
        
        await updateDepartment(department.id, updatedValues);
        toast({
          title: "Department updated",
          description: `${values.name} has been successfully updated.`,
        });
      }
      
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error saving department:", error);
      toast({
        title: "Error",
        description: "Failed to save department. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? "Create New Department" : `Edit ${department?.name}`}
          </DialogTitle>
          <DialogDescription>
            {isCreating
              ? "Add a new department to your organization."
              : "Make changes to the department details."}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Department Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Department Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter department name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Campus */}
              <FormField
                control={form.control}
                name="campus_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campus</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a campus" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {campuses.map((campus) => (
                          <SelectItem key={campus.id} value={campus.id}>
                            {campus.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Department Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {types.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Categorize the department by its function
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Logo URL */}
              <FormField
                control={form.control}
                name="logo"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter logo URL" {...field} />
                    </FormControl>
                    <FormDescription>
                      Provide a URL to the department&apos;s logo image
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter department description"
                        className="min-h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Active Status */}
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm md:col-span-2">
                    <div className="space-y-0.5">
                      <FormLabel>Active Status</FormLabel>
                      <FormDescription>
                        Determine whether this department is currently active
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
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isCreating ? "Create Department" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 