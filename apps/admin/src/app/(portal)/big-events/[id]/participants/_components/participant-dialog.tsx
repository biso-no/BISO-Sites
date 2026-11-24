"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type ParticipantCampusId,
  type ParticipantFormField,
  type ParticipantFormValues,
  participantFormSchema,
} from "@/lib/big-events/participant-form";
import { participantName } from "@/lib/big-events/participant-list";
import {
  addParticipant,
  updateParticipant,
} from "../../../../_actions/big-event-participants";
import { PortalButton } from "../../../../_components/portal-button";
import {
  PortalField,
  PortalInput,
  PortalSelect,
} from "../../../../_components/portal-fields";
import { SERIF_STACK, STUDIO } from "../../../../_components/studio";

type FieldErrors = Partial<Record<ParticipantFormField, string>>;

export interface CampusOption {
  label: string;
  /** A campus id, or `""` for "No campus". */
  value: string;
}

interface ParticipantDialogProps {
  bigEventId: string;
  campusOptions: CampusOption[];
  initial: ParticipantFormValues;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** The participant being edited; absent when adding someone. */
  participantId?: string;
}

function firstErrorPerField(
  issues: { path: PropertyKey[] }[],
  message: (field: ParticipantFormField) => string
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0] as ParticipantFormField | undefined;
    if (field && !errors[field]) {
      errors[field] = message(field);
    }
  }
  return errors;
}

/** Add someone by hand, or edit the details the ticket list gave. */
export function ParticipantDialog({
  bigEventId,
  campusOptions,
  initial,
  onOpenChange,
  open,
  participantId,
}: ParticipantDialogProps) {
  const t = useTranslations("adminPortal.bigEvents.participants.dialog");
  const tc = useTranslations("adminPortal.common");
  const router = useRouter();
  const [values, setValues] = useState<ParticipantFormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();
  const isEdit = participantId !== undefined;
  const initialName = participantName({
    first_name: initial.first_name,
    last_name: initial.last_name || null,
  });

  const update = <K extends keyof ParticipantFormValues>(
    key: K,
    value: ParticipantFormValues[K]
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = participantFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(
        firstErrorPerField(parsed.error.issues, (field) => t(`errors.${field}`))
      );
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        if (participantId) {
          await updateParticipant(participantId, parsed.data);
          toast.success(t("saved"));
        } else {
          await addParticipant(bigEventId, parsed.data);
          toast.success(
            t("added", {
              name: participantName({
                first_name: parsed.data.first_name,
                last_name: parsed.data.last_name || null,
              }),
            })
          );
        }
        onOpenChange(false);
        router.refresh();
      } catch {
        toast.error(t("saveFailed"));
      }
    });
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="border-[#e5dcca] bg-[#fffdf8] sm:rounded-2xl"
        style={{ color: STUDIO.ink }}
      >
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <DialogHeader>
            <DialogTitle
              className="font-normal text-[26px] leading-tight"
              style={{ fontFamily: SERIF_STACK }}
            >
              {isEdit ? t("editTitle", { name: initialName }) : t("addTitle")}
            </DialogTitle>
            <DialogDescription style={{ color: STUDIO.ink3 }}>
              {isEdit ? t("editDescription") : t("addDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <PortalField
              error={errors.first_name}
              label={t("firstName")}
              required
            >
              <PortalInput
                aria-label={t("firstName")}
                autoComplete="off"
                error={Boolean(errors.first_name)}
                maxLength={100}
                onChange={(e) => update("first_name", e.target.value)}
                value={values.first_name}
              />
            </PortalField>
            <PortalField error={errors.last_name} label={t("lastName")}>
              <PortalInput
                aria-label={t("lastName")}
                autoComplete="off"
                error={Boolean(errors.last_name)}
                maxLength={100}
                onChange={(e) => update("last_name", e.target.value)}
                value={values.last_name}
              />
            </PortalField>
          </div>
          <PortalField
            error={errors.ticket_email}
            hint={t("emailHelp")}
            label={t("email")}
          >
            <PortalInput
              aria-label={t("email")}
              autoComplete="off"
              error={Boolean(errors.ticket_email)}
              maxLength={320}
              onChange={(e) => update("ticket_email", e.target.value)}
              type="email"
              value={values.ticket_email}
            />
          </PortalField>
          <div className="grid gap-4 sm:grid-cols-2">
            <PortalField error={errors.phone} label={t("phone")}>
              <PortalInput
                aria-label={t("phone")}
                autoComplete="off"
                error={Boolean(errors.phone)}
                maxLength={40}
                onChange={(e) => update("phone", e.target.value)}
                type="tel"
                value={values.phone}
              />
            </PortalField>
            <PortalField error={errors.campus_id} label={t("campus")}>
              <PortalSelect
                aria-label={t("campus")}
                error={Boolean(errors.campus_id)}
                onChange={(e) =>
                  update(
                    "campus_id",
                    e.target.value === ""
                      ? null
                      : (e.target.value as ParticipantCampusId)
                  )
                }
                options={campusOptions}
                value={values.campus_id ?? ""}
              />
            </PortalField>
          </div>

          <DialogFooter className="gap-2">
            <PortalButton
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              variant="ghost"
            >
              {tc("cancel")}
            </PortalButton>
            <PortalButton loading={isPending} type="submit" variant="primary">
              {isEdit ? t("save") : t("add")}
            </PortalButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
