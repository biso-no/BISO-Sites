"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { updateProfile } from "@/lib/actions/user";
import { Models } from "@repo/api/server";
import { useAuth } from "@/lib/hooks/useAuth";

// Profile form schema
const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address").optional(),
  phone: z.string().min(8, "Phone number must be at least 8 characters").optional(),
  address: z.string().min(3, "Address is required").optional(),
  city: z.string().min(2, "City is required").optional(),
  zip: z.string().min(4, "ZIP/Postal code is required").optional(),
  bank_account: z.string().min(8, "Bank account must be at least 8 characters").optional(),
  swift: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  initialData: Models.Document | null | any;
  email: string;
}

export function ProfileForm({ initialData, email }: ProfileFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const { setProfile } = useAuth();

  // Log the initialData to understand its structure
  useEffect(() => {
    console.log("Profile form initial data:", initialData);
  }, [initialData]);

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: email || "",
      phone: initialData?.phone || "",
      address: initialData?.address || "",
      city: initialData?.city || "",
      zip: initialData?.zip || "",
      bank_account: initialData?.bank_account || "",
      swift: initialData?.swift || "",
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      console.log("Submitting profile data:", data);
      const result = await updateProfile(data);
      
      if (result) {
        console.log("Profile update result:", result);
        // Update the profile in the auth context
        setProfile(result);
        setSuccessMessage("Profile updated successfully");
        
        // Wait briefly before redirecting to ensure state updates
        setTimeout(() => {
          router.push("/expenses");
        }, 1000);
      } else {
        setErrorMessage("Failed to update profile. Server returned null.");
        console.error("Profile update failed - null result returned");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setErrorMessage(`Failed to update profile: ${error.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        {/* Success/Error Messages */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4"
          >
            {successMessage}
          </motion.div>
        )}

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4"
          >
            {errorMessage}
          </motion.div>
        )}

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name Field */}
          <div className="md:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register("name")}
              id="name"
              type="text"
              placeholder="Enter your full name"
              className={`w-full px-4 py-2.5 rounded-lg border ${
                errors.name ? "border-red-500" : "border-gray-300"
              } focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              {...register("email")}
              id="email"
              type="email"
              placeholder="Enter your email address"
              className={`w-full px-4 py-2.5 rounded-lg border ${
                errors.email ? "border-red-500" : "border-gray-300"
              } focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
              disabled // Email should typically not be editable
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Phone Field */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              {...register("phone")}
              id="phone"
              type="tel"
              placeholder="Enter your phone number"
              className={`w-full px-4 py-2.5 rounded-lg border ${
                errors.phone ? "border-red-500" : "border-gray-300"
              } focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>
            )}
          </div>

          <div className="border-t border-gray-100 md:col-span-2 pt-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4">
              Address Information
            </h3>
          </div>

          {/* Address Field */}
          <div className="md:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Street Address
            </label>
            <input
              {...register("address")}
              id="address"
              type="text"
              placeholder="Enter your street address"
              className={`w-full px-4 py-2.5 rounded-lg border ${
                errors.address ? "border-red-500" : "border-gray-300"
              } focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
            />
            {errors.address && (
              <p className="mt-1 text-sm text-red-500">{errors.address.message}</p>
            )}
          </div>

          {/* City Field */}
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
              City
            </label>
            <input
              {...register("city")}
              id="city"
              type="text"
              placeholder="Enter your city"
              className={`w-full px-4 py-2.5 rounded-lg border ${
                errors.city ? "border-red-500" : "border-gray-300"
              } focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
            />
            {errors.city && (
              <p className="mt-1 text-sm text-red-500">{errors.city.message}</p>
            )}
          </div>

          {/* ZIP/Postal Code Field */}
          <div>
            <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-1">
              ZIP/Postal Code
            </label>
            <input
              {...register("zip")}
              id="zip"
              type="text"
              placeholder="Enter your ZIP/Postal code"
              className={`w-full px-4 py-2.5 rounded-lg border ${
                errors.zip ? "border-red-500" : "border-gray-300"
              } focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
            />
            {errors.zip && (
              <p className="mt-1 text-sm text-red-500">{errors.zip.message}</p>
            )}
          </div>

          <div className="border-t border-gray-100 md:col-span-2 pt-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4">
              Banking Information
            </h3>
          </div>

          {/* Bank Account Field */}
          <div>
            <label htmlFor="bank_account" className="block text-sm font-medium text-gray-700 mb-1">
              Bank Account Number
            </label>
            <input
              {...register("bank_account")}
              id="bank_account"
              type="text"
              placeholder="Enter your bank account number"
              className={`w-full px-4 py-2.5 rounded-lg border ${
                errors.bank_account ? "border-red-500" : "border-gray-300"
              } focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
            />
            {errors.bank_account && (
              <p className="mt-1 text-sm text-red-500">{errors.bank_account.message}</p>
            )}
          </div>

          {/* SWIFT Field */}
          <div>
            <label htmlFor="swift" className="block text-sm font-medium text-gray-700 mb-1">
              SWIFT/BIC Code
            </label>
            <input
              {...register("swift")}
              id="swift"
              type="text"
              placeholder="For international transfers (optional)"
              className={`w-full px-4 py-2.5 rounded-lg border ${
                errors.swift ? "border-red-500" : "border-gray-300"
              } focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
            />
            {errors.swift && (
              <p className="mt-1 text-sm text-red-500">{errors.swift.message}</p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-lg shadow-sm hover:shadow transition duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 