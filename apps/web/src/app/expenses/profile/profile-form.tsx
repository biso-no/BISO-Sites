"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Models } from "@repo/api";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  type FieldErrors,
  type UseFormRegister,
  useForm,
} from "react-hook-form";
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

type ProfileFieldConfig = {
  name: keyof ProfileFormValues;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  colSpan?: boolean;
  disabled?: boolean;
};

type ProfileInputFieldProps = ProfileFieldConfig & {
  register: UseFormRegister<ProfileFormValues>;
  errors: FieldErrors<ProfileFormValues>;
};

const ProfileInputField = ({
  name,
  label,
  placeholder,
  type = "text",
  required,
  colSpan,
  disabled,
  register,
  errors,
}: ProfileInputFieldProps) => {
  const error = errors[name]?.message as string | undefined;
  return (
    <div className={colSpan ? "md:col-span-2" : undefined}>
      <label
        className="mb-1 block font-medium text-muted-foreground text-sm"
        htmlFor={name}
      >
        {label} {required ? "*" : null}
      </label>
      <input
        {...register(name)}
        className={`w-full rounded-lg border px-4 py-2.5 ${
          error ? "border-red-500" : "border-border"
        } transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500`}
        disabled={disabled}
        id={name}
        placeholder={placeholder}
        type={type}
      />
      {error ? <p className="mt-1 text-red-500 text-sm">{error}</p> : null}
    </div>
  );
};

type FormMessagesProps = {
  successMessage: string | null;
  errorMessage: string | null;
};

const FormMessages = ({ successMessage, errorMessage }: FormMessagesProps) => (
  <>
    {successMessage ? (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800"
        exit={{ opacity: 0, y: -10 }}
        initial={{ opacity: 0, y: -10 }}
      >
        {successMessage}
      </motion.div>
    ) : null}

    {errorMessage ? (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
        exit={{ opacity: 0, y: -10 }}
        initial={{ opacity: 0, y: -10 }}
      >
        {errorMessage}
      </motion.div>
    ) : null}
  </>
);

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

  const contactFields: ProfileFieldConfig[] = [
    {
      name: "name",
      label: "Full Name",
      placeholder: "Enter your full name",
      required: true,
      colSpan: true,
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
      required: true,
    },
  ];

  const addressFields: ProfileFieldConfig[] = [
    {
      name: "address",
      label: "Street Address",
      placeholder: "Enter your street address",
      required: true,
      colSpan: true,
    },
    {
      name: "city",
      label: "City",
      placeholder: "Enter your city",
      required: true,
    },
    {
      name: "zip",
      label: "ZIP/Postal code",
      placeholder: "Enter your ZIP/Postal code",
      required: true,
    },
  ];

  const bankingFields: ProfileFieldConfig[] = [
    {
      name: "bank_account",
      label: "Bank account",
      placeholder: "Enter your bank account number",
      required: true,
    },
    {
      name: "swift",
      label: "SWIFT Code (Optional)",
      placeholder: "Enter your SWIFT code (if applicable)",
    },
  ];

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
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
      <form className="space-y-6 p-6" onSubmit={handleSubmit(onSubmit)}>
        <FormMessages
          errorMessage={errorMessage}
          successMessage={successMessage}
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {contactFields.map((field) => (
            <ProfileInputField
              errors={errors}
              key={field.name}
              register={register}
              {...field}
            />
          ))}
        </div>

        <div className="border-border border-t pt-6 md:col-span-2">
          <h3 className="mb-4 font-medium text-foreground text-lg">
            Address Information
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {addressFields.map((field) => (
            <ProfileInputField
              errors={errors}
              key={field.name}
              register={register}
              {...field}
            />
          ))}
        </div>

        <div className="border-border border-t pt-6 md:col-span-2">
          <h3 className="mb-4 font-medium text-foreground text-lg">
            Banking Information
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {bankingFields.map((field) => (
            <ProfileInputField
              errors={errors}
              key={field.name}
              register={register}
              {...field}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
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
                  <title>Submitting profile</title>
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
                Submitting...
              </>
            ) : (
              "Update Profile"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
