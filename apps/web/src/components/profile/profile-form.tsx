"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ProfileFormInitialData,
  type ProfileFormValues,
  profileFormSchema,
} from "@repo/shared/types/profile-form";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  type FieldErrors,
  type UseFormRegister,
  useForm,
} from "react-hook-form";
import { updateProfile } from "@/lib/actions/user";

interface ProfileFormProps {
  email: string;
  initialData: ProfileFormInitialData | null;
}

interface ProfileFieldConfig {
  colSpan?: boolean;
  disabled?: boolean;
  label: string;
  name: keyof ProfileFormValues;
  placeholder?: string;
  required?: boolean;
  type?: string;
}

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
        className="type-body-sm mb-1.5 block font-semibold text-ink"
        htmlFor={name}
      >
        {label} {required ? "*" : null}
      </label>
      {/* Focus indicator. These inputs had `focus:outline-none focus:ring-2
          focus:ring-blue-500`, which computed to no outline AND an
          all-transparent box-shadow — every field of this form was keyboard-
          focusable with nothing at all to show for it.
          FINDING-F is fixed in RD-030: the universal `outline-ring/50` rule
          that used to beat every `outline-<color>` utility is gone, so this
          outline paints the focus-ring blue it asks for. */}
      <input
        {...register(name)}
        aria-describedby={error ? `${name}-error` : undefined}
        aria-invalid={error ? true : undefined}
        className={`type-body w-full rounded-biso-md border bg-surface px-4 py-2.5 text-ink placeholder:text-ink-muted disabled:bg-surface-sunken disabled:text-ink-muted ${
          error ? "border-danger" : "border-edge"
        } transition duration-200 focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2`}
        disabled={disabled}
        id={name}
        placeholder={placeholder}
        type={type}
      />
      {error ? (
        <p className="type-body-sm mt-1.5 text-danger" id={`${name}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
};

interface FormMessagesProps {
  errorMessage: string | null;
  successMessage: string | null;
}

const FormMessages = ({ successMessage, errorMessage }: FormMessagesProps) => (
  <>
    {successMessage ? (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="type-body-sm rounded-biso-md border border-success/40 bg-success/5 p-4 text-success"
        exit={{ opacity: 0, y: -10 }}
        initial={{ opacity: 0, y: -10 }}
        role="status"
      >
        {successMessage}
      </motion.div>
    ) : null}

    {errorMessage ? (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="type-body-sm rounded-biso-md border border-danger/40 bg-danger/5 p-4 text-danger"
        exit={{ opacity: 0, y: -10 }}
        initial={{ opacity: 0, y: -10 }}
        role="alert"
      >
        {errorMessage}
      </motion.div>
    ) : null}
  </>
);

export function ProfileForm({ initialData, email }: ProfileFormProps) {
  const t = useTranslations("common.profile");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const _router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
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
      label: t("fields.name.label"),
      placeholder: t("fields.name.placeholder"),
      required: true,
      colSpan: true,
    },
    {
      name: "email",
      label: t("fields.email.label"),
      placeholder: t("fields.email.placeholder"),
      type: "email",
      disabled: true,
    },
    {
      name: "phone",
      label: t("fields.phone.label"),
      placeholder: t("fields.phone.placeholder"),
      type: "tel",
      required: true,
    },
  ];

  const addressFields: ProfileFieldConfig[] = [
    {
      name: "address",
      label: t("fields.address.label"),
      placeholder: t("fields.address.placeholder"),
      required: true,
      colSpan: true,
    },
    {
      name: "city",
      label: t("fields.city.label"),
      placeholder: t("fields.city.placeholder"),
      required: true,
    },
    {
      name: "zip",
      label: t("fields.zip.label"),
      placeholder: t("fields.zip.placeholder"),
      required: true,
    },
  ];

  const bankingFields: ProfileFieldConfig[] = [
    {
      name: "bank_account",
      label: t("fields.bankAccount.label"),
      placeholder: t("fields.bankAccount.placeholder"),
      required: true,
    },
    {
      name: "swift",
      label: t("fields.swift.label"),
      placeholder: t("fields.swift.placeholder"),
    },
  ];

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const result = await updateProfile(data);

      if (result) {
        setSuccessMessage(t("saved"));
      } else {
        setErrorMessage(t("saveFailed"));
      }
    } catch (error) {
      // The reason goes to the console, not the visitor: the action's own
      // error text is written for developers.
      console.error("Failed to update profile:", error);
      setErrorMessage(t("saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // The account tab already frames this form in a bordered panel; it adds
    // no second card of its own.
    <div>
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
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

        <div className="border-edge border-t pt-6 md:col-span-2">
          <h3 className="type-heading-card mb-4 text-ink">
            {t("addressInfo")}
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

        <div className="border-edge border-t pt-6 md:col-span-2">
          <h3 className="type-heading-card mb-4 text-ink">
            {t("bankingInfo")}
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
            aria-busy={isSubmitting}
            className="type-label inline-flex items-center gap-2 rounded-biso-pill bg-action px-5 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <>
                <svg
                  aria-hidden="true"
                  className="size-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>{t("submitting")}</title>
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
                {t("updating")}
              </>
            ) : (
              t("update")
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
