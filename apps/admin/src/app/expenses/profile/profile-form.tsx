"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Models } from "@repo/api";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { updateProfile } from "@/lib/actions/user";

// Profile form schema
const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address").optional(),
  phone: z
    .string()
    .min(8, "Phone number must be at least 8 characters")
    .optional(),
  address: z.string().min(3, "Address is required").optional(),
  city: z.string().min(2, "City is required").optional(),
  zip: z.string().min(4, "ZIP/Postal code is required").optional(),
  bank_account: z
    .string()
    .min(8, "Bank account must be at least 8 characters")
    .optional(),
  swift: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

type ProfileFormProps = {
  initialData: Models.Document | null | any;
  email: string;
};

export function ProfileForm({ initialData, email }: ProfileFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const _router = useRouter();

  // Log the initialData to understand its structure
  useEffect(() => {
    console.log("Profile form initial data:", initialData);
  }, [initialData]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
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
        // TODO: Update the profile in the database and revalidate the profile page
        setSuccessMessage("Profile updated successfully");
      } else {
        setErrorMessage("Failed to update profile. Server returned null.");
        console.error("Profile update failed - null result returned");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setErrorMessage(
        `Failed to update profile: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
      <form className="space-y-6 p-6" onSubmit={handleSubmit(onSubmit)}>
        {/* Success/Error Messages */}
        {successMessage && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800"
            exit={{ opacity: 0, y: -10 }}
            initial={{ opacity: 0, y: -10 }}
          >
            {successMessage}
          </motion.div>
        )}

        {errorMessage && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
            exit={{ opacity: 0, y: -10 }}
            initial={{ opacity: 0, y: -10 }}
          >
            {errorMessage}
          </motion.div>
        )}

        {/* Form Fields */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Name Field */}
          <div className="md:col-span-2">
            <label
              className="mb-1 block font-medium text-gray-700 text-sm"
              htmlFor="name"
            >
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register("name")}
              className={`w-full rounded-lg border px-4 py-2.5 ${
                errors.name ? "border-red-500" : "border-gray-300"
              } transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              id="name"
              placeholder="Enter your full name"
              type="text"
            />
            {errors.name && (
              <p className="mt-1 text-red-500 text-sm">{errors.name.message}</p>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label
              className="mb-1 block font-medium text-gray-700 text-sm"
              htmlFor="email"
            >
              Email Address
            </label>
            <input
              {...register("email")}
              className={`w-full rounded-lg border px-4 py-2.5 ${
                errors.email ? "border-red-500" : "border-gray-300"
              } transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              disabled
              id="email"
              placeholder="Enter your email address"
              type="email" // Email should typically not be editable
            />
            {errors.email && (
              <p className="mt-1 text-red-500 text-sm">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Phone Field */}
          <div>
            <label
              className="mb-1 block font-medium text-gray-700 text-sm"
              htmlFor="phone"
            >
              Phone Number
            </label>
            <input
              {...register("phone")}
              className={`w-full rounded-lg border px-4 py-2.5 ${
                errors.phone ? "border-red-500" : "border-gray-300"
              } transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              id="phone"
              placeholder="Enter your phone number"
              type="tel"
            />
            {errors.phone && (
              <p className="mt-1 text-red-500 text-sm">
                {errors.phone.message}
              </p>
            )}
          </div>

          <div className="border-gray-100 border-t pt-6 md:col-span-2">
            <h3 className="mb-4 font-medium text-gray-800 text-lg">
              Address Information
            </h3>
          </div>

          {/* Address Field */}
          <div className="md:col-span-2">
            <label
              className="mb-1 block font-medium text-gray-700 text-sm"
              htmlFor="address"
            >
              Street Address
            </label>
            <input
              {...register("address")}
              className={`w-full rounded-lg border px-4 py-2.5 ${
                errors.address ? "border-red-500" : "border-gray-300"
              } transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              id="address"
              placeholder="Enter your street address"
              type="text"
            />
            {errors.address && (
              <p className="mt-1 text-red-500 text-sm">
                {errors.address.message}
              </p>
            )}
          </div>

          {/* City Field */}
          <div>
            <label
              className="mb-1 block font-medium text-gray-700 text-sm"
              htmlFor="city"
            >
              City
            </label>
            <input
              {...register("city")}
              className={`w-full rounded-lg border px-4 py-2.5 ${
                errors.city ? "border-red-500" : "border-gray-300"
              } transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              id="city"
              placeholder="Enter your city"
              type="text"
            />
            {errors.city && (
              <p className="mt-1 text-red-500 text-sm">{errors.city.message}</p>
            )}
          </div>

          {/* ZIP/Postal Code Field */}
          <div>
            <label
              className="mb-1 block font-medium text-gray-700 text-sm"
              htmlFor="zip"
            >
              ZIP/Postal Code
            </label>
            <input
              {...register("zip")}
              className={`w-full rounded-lg border px-4 py-2.5 ${
                errors.zip ? "border-red-500" : "border-gray-300"
              } transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              id="zip"
              placeholder="Enter your ZIP/Postal code"
              type="text"
            />
            {errors.zip && (
              <p className="mt-1 text-red-500 text-sm">{errors.zip.message}</p>
            )}
          </div>

          <div className="border-gray-100 border-t pt-6 md:col-span-2">
            <h3 className="mb-4 font-medium text-gray-800 text-lg">
              Banking Information
            </h3>
          </div>

          {/* Bank Account Field */}
          <div>
            <label
              className="mb-1 block font-medium text-gray-700 text-sm"
              htmlFor="bank_account"
            >
              Bank Account Number
            </label>
            <input
              {...register("bank_account")}
              className={`w-full rounded-lg border px-4 py-2.5 ${
                errors.bank_account ? "border-red-500" : "border-gray-300"
              } transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              id="bank_account"
              placeholder="Enter your bank account number"
              type="text"
            />
            {errors.bank_account && (
              <p className="mt-1 text-red-500 text-sm">
                {errors.bank_account.message}
              </p>
            )}
          </div>

          {/* SWIFT Field */}
          <div>
            <label
              className="mb-1 block font-medium text-gray-700 text-sm"
              htmlFor="swift"
            >
              SWIFT/BIC Code
            </label>
            <input
              {...register("swift")}
              className={`w-full rounded-lg border px-4 py-2.5 ${
                errors.swift ? "border-red-500" : "border-gray-300"
              } transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              id="swift"
              placeholder="For international transfers (optional)"
              type="text"
            />
            {errors.swift && (
              <p className="mt-1 text-red-500 text-sm">
                {errors.swift.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end border-gray-100 border-t pt-4">
          <button
            className="flex items-center rounded-lg bg-linear-to-r from-blue-500 to-indigo-600 px-6 py-3 font-medium text-white shadow-sm transition duration-200 hover:from-blue-600 hover:to-indigo-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    fill="currentColor"
                  />
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
