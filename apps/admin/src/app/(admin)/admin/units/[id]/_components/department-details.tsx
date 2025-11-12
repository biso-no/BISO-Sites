"use client";

import { useState } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Users, MapPin, Calendar, Lock, Edit, Save, ArrowLeft, X, Upload } from 'lucide-react';
import { Department } from '@/lib/admin/departments';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from '@/components/ui/separator';
import { updateDepartment } from '@/lib/admin/departments';
import { toast } from '@/lib/hooks/use-toast';
import { RichTextEditor } from '@/components/rich-text-editor';
import { uploadUnitLogo } from '@/app/actions/units';
import { clientStorage } from '@/lib/appwrite-client';
import { ID } from 'appwrite';


// Define the form schema with validation
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  campus_id: z.string().min(1, "Campus is required"),
  type: z.string().optional(),
  logo: z.string().optional(),
  description: z.string()
    .max(4000, "Description cannot exceed 4000 characters")
    .optional(),
  active: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface DepartmentDetailsProps {
  department: Department;
  campuses: Array<{ id: string; name: string; }>;
  departmentTypes: string[];
}

export function DepartmentDetails({ department, campuses, departmentTypes }: DepartmentDetailsProps) {
  const router = useRouter();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  // Setup form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: department.name,
      campus_id: department.campus_id,
      type: department.type || 'none',
      logo: department.logo || '',
      description: department.description || '',
      active: department.active,
    },
  });
  
  // Create state for rich text editor
  const [description, setDescription] = useState(department.description || '');
  
  const placeholderLogo = "https://via.placeholder.com/120?text=" + 
    encodeURIComponent(department.name.substring(0, 2));
  
  const logoUrl = logoPreview || department.logo || placeholderLogo;
  
  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      await updateDepartment(department.$id, {
        ...values,
        type: values.type === 'none' ? '' : values.type,
      });
      
      toast({
        title: "Success",
        description: "Department updated successfully",
      });
      
      setIsEditMode(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update department",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Create a preview and get base64 data
        const reader = new FileReader();
        reader.onload = async (event) => {
          if (event.target?.result) {
            const base64Data = event.target.result as string;
            setLogoPreview(base64Data);

            // Upload the file to Appwrite
            const result = await clientStorage.createFile('units', ID.unique(), file)
            
            if (result) {
              form.setValue('logo', result.$id);
              toast({
                title: "Success",
                description: "Logo uploaded successfully",
              });
            } else {
              toast({
                title: "Error",
                description: "Failed to upload logo",
                variant: "destructive",
              });
            }
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Error uploading logo:', error);
        toast({
          title: "Error",
          description: "Failed to upload logo",
          variant: "destructive",
        });
      }
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header with navigation and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/admin/units')}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Units
          </Button>
          <h1 className="text-2xl font-bold">
            {isEditMode ? "Edit Department" : department.name}
          </h1>
          {!department.active && (
            <Badge variant="destructive" className="ml-2">Inactive</Badge>
          )}
        </div>
        
        <div className="flex gap-2">
          {isEditMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditMode(false)}
                disabled={isSubmitting}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={form.handleSubmit(handleSubmit)}
                disabled={isSubmitting}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditMode(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Department
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - Left side */}
        <div className="lg:col-span-2 space-y-6">
          {isEditMode ? (
            <Form {...form}>
              <form className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter department name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="campus_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campus</FormLabel>
                        <Select 
                          value={field.value} 
                          onValueChange={field.onChange}
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
                  
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department Type</FormLabel>
                        <Select 
                          value={field.value} 
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {departmentTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <RichTextEditor
                          content={description}
                          onChange={(html) => {
                            setDescription(html);
                            field.onChange(html);
                          }}
                          editable={isEditMode}
                        />
                      </FormControl>
                      <FormDescription>
                        The description will be displayed in the department card and details. 
                        Maximum 4000 characters.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <h2 className="text-xl font-semibold">Description</h2>
              </CardHeader>
              <CardContent>
                {department.description ? (
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: department.description }}
                  />
                ) : (
                  <p className="text-muted-foreground italic">No description available</p>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Relationships will go here in a future update */}
          {!isEditMode && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Related Content</h2>
              <Card>
                <CardHeader className="pb-2">
                  <h3 className="text-lg font-medium">Users</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    {department.userCount 
                      ? `${department.userCount} users are assigned to this department`
                      : 'No users are assigned to this department'}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" size="sm">View Users</Button>
                </CardFooter>
              </Card>
              
              {/* Placeholder for other relationships */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-medium">News</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Recent news articles from this department
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" size="sm">View News</Button>
                  </CardFooter>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-medium">Events</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Upcoming and past events
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" size="sm">View Events</Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          )}
        </div>
        
        {/* Sidebar - Right side */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-xl font-semibold">Department Details</h2>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative mb-4">
                  <div className="h-32 w-32 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center border border-border">
                    {department.logo || logoPreview ? (
                      <Image 
                        src={logoUrl}
                        alt={department.name}
                        width={128}
                        height={128}
                        className="object-cover h-full w-full"
                      />
                    ) : (
                      <span className="text-4xl font-bold text-primary/70">
                        {department.name.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {isEditMode && (
                    <label 
                      htmlFor="logo-upload" 
                      className="absolute bottom-0 right-0 bg-primary text-primary-foreground h-8 w-8 rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-primary/90 transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      <input 
                        id="logo-upload" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleLogoChange}
                      />
                    </label>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-center">
                  {department.name}
                </h3>
                {department.type && (
                  <Badge variant="outline" className="mt-1">
                    {department.type}
                  </Badge>
                )}
              </div>
              
              <Separator />
              
              {/* Status */}
              {isEditMode ? (
                <Form {...form}>
                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Active Status
                          </FormLabel>
                          <FormDescription>
                            Deactivated departments will be hidden from most views.
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
                </Form>
              ) : (
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${department.active ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-medium">
                    {department.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              )}
              
              <Separator />
              
              {/* Additional Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{department.campusName || 'No campus assigned'}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{department.userCount || 0} members</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Created: {department.$createdAt}</span>
                </div>
                
                {!isEditMode && (
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span>ID: {department.$id}</span>
                  </div>
                )}
              </div>
            </CardContent>
            {isEditMode && (
              <CardFooter>
                <Button 
                  className="w-full"
                  onClick={form.handleSubmit(handleSubmit)}
                  disabled={isSubmitting}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}