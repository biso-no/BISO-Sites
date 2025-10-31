"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useToast } from "@repo/ui/components/ui/use-toast"
import { Button } from "@repo/ui/components/ui/button"
import { Input } from "@repo/ui/components/ui/input"
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
  CreditCard,
  User,
  Mail,
  Phone,
  Edit2,
  Save,
  Loader2,
  Globe,
} from "lucide-react"
import { cn } from '@repo/ui/lib/utils'
import { Models } from "@repo/api/server"
import { useAuth } from "@/lib/hooks/useAuth"
import { updateProfileDetails } from "../../../actions"

const contactSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(8, "Phone number is required"),
})

const bankSchema = z.object({
  bank_account: z.string().min(8, "Account number must be at least 8 characters"),
  isInternational: z.boolean().default(false),
  swift: z.string().optional().or(z.literal("")).transform(val => val || undefined),
})

const formSchema = z.object({
  ...contactSchema.shape,
  ...bankSchema.shape,
})

type FormValues = z.infer<typeof formSchema>

interface ContactAndBankDetailsProps {
  onNext: () => void
  existingProfile?: Models.Document
  onUpdate: (data: any) => void
  profile: Models.Document
}

export function ContactAndBankDetails({
  onNext,
  existingProfile,
  onUpdate,
}: ContactAndBankDetailsProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isEditingContact, setIsEditingContact] = useState(false)
  const [isEditingBank, setIsEditingBank] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingBank, setIsSavingBank] = useState(false)
  const [savingField, setSavingField] = useState<string | null>(null)
  const { toast } = useToast()
  const { profile, isLoading: profileLoading } = useAuth()

  // Track if this is first load with no profile
  const [isNewProfile, setIsNewProfile] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      bank_account: "",
      isInternational: false,
      swift: "",
    },
  })

  useEffect(() => {
    if (profile && !profileLoading) {
      form.reset({
        name: profile.name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        bank_account: profile.bank_account || "",
        isInternational: false,
        swift: profile.swift || "",
      })
      // Only set as new profile if there's no profile ID
      setIsNewProfile(!profile.$id)
      
      // If no contact info, enable contact editing
      if (!profile.name && !profile.email && !profile.phone) {
        setIsEditingContact(true)
      }
      // If no bank info, enable bank editing
      if (!profile.bank_account) {
        setIsEditingBank(true)
      }
      setIsLoading(false)
    }
  }, [profile, profileLoading, form])

  const onSubmit = async (values: FormValues) => {
    onUpdate(values)
    onNext()
  }

  const handleSaveField = async (fieldName: string, value: string) => {
    setSavingField(fieldName)
    try {
      if (!profile?.$id) {
        throw new Error('Profile ID not found');
      }
      await updateProfileDetails(profile.$id, {
        [fieldName]: value,
      });
      toast({
        title: "Field Updated",
        description: `Your ${fieldName.replace('_', ' ')} has been updated successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to update ${fieldName.replace('_', ' ')}`,
        variant: "destructive",
      })
    } finally {
      setSavingField(null)
    }
  }

  const handleSaveProfile = async () => {
    const values = form.getValues();
    setIsSavingProfile(true)
    try {
      if (!profile?.$id) {
        throw new Error('Profile ID not found');
      }
      await updateProfileDetails(profile.$id, {
        name: values.name,
        email: values.email,
        phone: values.phone,
      });
      toast({
        title: "Profile Updated",
        description: "Your contact information has been updated successfully.",
      })
      setIsEditingContact(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSaveBank = async () => {
    const values = form.getValues();
    setIsSavingBank(true)
    try {
      if (!profile?.$id) {
        throw new Error('Profile ID not found');
      }
      await updateProfileDetails(profile.$id, {
        bank_account: values.bank_account,
        ...(values.isInternational ? { swift: values.swift } : { swift: undefined }),
      });
      toast({
        title: "Bank Details Updated",
        description: "Your bank information has been updated successfully.",
      })
      setIsEditingBank(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update bank details",
        variant: "destructive",
      })
    } finally {
      setIsSavingBank(false)
    }
  }

  // Render a field with conditional editing and individual save button
  const renderField = (
    name: keyof FormValues,
    label: string,
    icon: React.ReactNode,
    type: string = "text",
    section: "contact" | "bank" = "contact"
  ) => {
    const isEditing = section === "contact" ? isEditingContact : isEditingBank;
    const value = form.watch(name);
    const isEmpty = !value;
    const showIndividualEdit = isEmpty && !isEditing && !isNewProfile;

    // Skip rendering save button for isInternational field
    const isToggleField = name === 'isInternational';
    if (isToggleField) {
      return (
        <FormField
          control={form.control}
          name={name}
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="flex items-center gap-2">
                  {icon}
                  {label}
                </FormLabel>
                <FormDescription>
                  Enable if this is an international bank account
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value as boolean}
                  onCheckedChange={field.onChange}
                  disabled={!isEditingBank}
                />
              </FormControl>
            </FormItem>
          )}
        />
      );
    }

    return (
      <motion.div
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <FormField
          control={form.control}
          name={name}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                {icon}
                {label}
              </FormLabel>
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  {(isEditing || showIndividualEdit) ? (
                    <FormControl>
                      <Input {...field} type={type} className={type === "tel" ? "" : "font-mono"} />
                    </FormControl>
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-md text-gray-700">
                      {field.value || "Not set"}
                    </div>
                  )}
                </div>
                {showIndividualEdit && !isToggleField && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveField(name, field.value as string)}
                    disabled={savingField === name}
                    className="mt-0"
                  >
                    {savingField === name ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </motion.div>
    );
  };

  if (isLoading && profileLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
          <p className="text-sm text-gray-500">Loading your profile...</p>
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-6">
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>
                  Your contact details for this expense claim.
                </CardDescription>
              </div>
              {!isNewProfile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={isEditingContact ? handleSaveProfile : () => setIsEditingContact(true)}
                  disabled={isEditingContact && isSavingProfile}
                  className={cn(
                    "transition-colors",
                    isEditingContact &&
                      "border-blue-500 text-blue-500 hover:bg-blue-50"
                  )}
                >
                  {isEditingContact ? (
                    isSavingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Profile
                      </>
                    )
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderField("name", "Full Name", <User className="w-4 h-4 text-blue-500" />)}
              {renderField("email", "Email", <Mail className="w-4 h-4 text-blue-500" />, "email")}
              {renderField("phone", "Phone", <Phone className="w-4 h-4 text-blue-500" />, "tel")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Bank Details</CardTitle>
                <CardDescription>
                  Your bank account information for reimbursement.
                </CardDescription>
              </div>
              {!isNewProfile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={isEditingBank ? handleSaveBank : () => setIsEditingBank(true)}
                  disabled={isEditingBank && isSavingBank}
                  className={cn(
                    "transition-colors",
                    isEditingBank &&
                      "border-blue-500 text-blue-500 hover:bg-blue-50"
                  )}
                >
                  {isEditingBank ? (
                    isSavingBank ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Bank Details
                      </>
                    )
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {renderField("bank_account", "Account Number", <CreditCard className="w-4 h-4 text-blue-500" />, "text", "bank")}

            {renderField("isInternational", "International Account", <CreditCard className="w-4 h-4 text-blue-500" />, "text", "bank")}

            {form.watch("isInternational") && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                {renderField("swift", "SWIFT/BIC Code", <CreditCard className="w-4 h-4 text-blue-500" />, "text", "bank")}
              </motion.div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
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