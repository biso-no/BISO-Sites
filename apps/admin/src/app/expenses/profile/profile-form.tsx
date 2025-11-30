"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Models } from "@repo/api";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

type FieldConfig = {
  name: keyof ProfileFormValues;
  label: string;
  placeholder: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  gridClassName?: string;
};

export function ProfileForm({ initialData, email }: ProfileFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const _router = useRouter();

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

  const contactFields: FieldConfig[] = [
    {
      name: "name",
      label: "Full Name",
      placeholder: "Enter your full name",
      required: true,
      gridClassName: "md:col-span-2",
    },
    {
      name: "email",
      label: "Email Address",
      placeholder: "Enter your email address",
      type: "email",
      disabled: true,
    },
    {
      name: "phone",
      label: "Phone Number",
      placeholder: "Enter your phone number",
      type: "tel",
    },
  ];

  const addressFields: FieldConfig[] = [
    {
      name: "address",
      label: "Street Address",
      placeholder: "Enter your street address",
      gridClassName: "md:col-span-2",
    },
    {
      name: "city",
      label: "City",
      placeholder: "Enter your city",
    },
    {
      name: "zip",
      label: "ZIP/Postal Code",
      placeholder: "Enter your ZIP/Postal code",
    },
  ];

  const bankFields: FieldConfig[] = [
    {
      name: "bank_account",
      label: "Bank Account Number",
      placeholder: "Enter your bank account number",
    },
    {
      name: "swift",
      label: "SWIFT/BIC",
      placeholder: "Enter your SWIFT/BIC code",
    },
  ];

  const renderField = ({
    name,
    label,
    placeholder,
    type = "text",
    required,
    disabled,
    gridClassName,
  }: FieldConfig) => {
    const fieldErrorMessage = errors[name]?.message;
    return (
      <div className={gridClassName} key={name}>
        <label
          className="mb-1 block font-medium text-gray-700 text-sm"
          htmlFor={name}
        >
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
        <input
          {...register(name)}
          className={`w-full rounded-lg border px-4 py-2.5 ${
            fieldErrorMessage ? "border-red-500" : "border-gray-300"
          } transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500`}
          disabled={disabled}
          id={name}
          placeholder={placeholder}
          type={type}
        />
        {fieldErrorMessage ? (
          <p className="mt-1 text-red-500 text-sm">{fieldErrorMessage}</p>
        ) : null}
      </div>
    );
  };

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const result = await updateProfile(data);

      if (result) {
        setSuccessMessage("Profile updated successfully");
      } else {
        setErrorMessage("Failed to update profile. Server returned null.");
      }
    } catch (error) {
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
          {contactFields.map(renderField)}

          <div className="border-gray-100 border-t pt-6 md:col-span-2">
            <h3 className="mb-4 font-medium text-gray-800 text-lg">
              Address Information
            </h3>
          </div>

          {addressFields.map(renderField)}

          <div className="border-gray-100 border-t pt-6 md:col-span-2">
            <h3 className="mb-4 font-medium text-gray-800 text-lg">
              Banking Information
            </h3>
          </div>

          {bankFields.map(renderField)}
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
                  aria-label="Saving"
                  className="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
                  fill="none"
                  role="img"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>Saving</title>
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
