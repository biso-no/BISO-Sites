"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Separator } from "@repo/ui/components/ui/separator";
import { Building2 } from "lucide-react";

type SummaryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    profile: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      zip?: string | null;
      city?: string | null;
      bank_account?: string | null;
      swift?: string | null;
    };
    campus: string;
    department: string;
    attachments: Array<{
      description: string;
      date: string;
      amount: number;
    }>;
    description: string;
    total: number;
  };
  onSubmit: () => void;
  isSubmitting?: boolean;
};

export function SummaryDialog({
  open,
  onOpenChange,
  data,
  onSubmit,
  isSubmitting,
}: SummaryDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Your Reimbursement</DialogTitle>
          <DialogDescription>
            Please review all details before submitting
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact Info */}
          <div>
            <h4 className="mb-3 font-semibold text-gray-900">
              Contact Information
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Name:</span>
                <p className="text-gray-900">{data.profile.name}</p>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>
                <p className="text-gray-900">{data.profile.email}</p>
              </div>
              <div>
                <span className="text-gray-500">Phone:</span>
                <p className="text-gray-900">{data.profile.phone}</p>
              </div>
              <div>
                <span className="text-gray-500">Address:</span>
                <p className="text-gray-900">
                  {data.profile.address}, {data.profile.zip} {data.profile.city}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Bank Account:</span>
                <p className="text-gray-900">{data.profile.bank_account}</p>
              </div>
              {data.profile.swift && (
                <div className="col-span-2">
                  <span className="text-gray-500">SWIFT/BIC:</span>
                  <p className="text-gray-900">{data.profile.swift}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Campus & Department */}
          <div>
            <h4 className="mb-3 font-semibold text-gray-900">Assignment</h4>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-[#3DA9E0]" />
              <span className="text-gray-900">
                {data.campus} - {data.department}
              </span>
            </div>
          </div>

          <Separator />

          {/* Receipts */}
          <div>
            <h4 className="mb-3 font-semibold text-gray-900">
              Receipts ({data.attachments.length})
            </h4>
            <div className="space-y-2">
              {data.attachments.map((att, index) => (
                <div
                  className="flex items-center justify-between rounded bg-gray-50 p-2 text-sm"
                  key={index}
                >
                  <div>
                    <p className="text-gray-900">{att.description}</p>
                    <p className="text-gray-500 text-xs">{att.date}</p>
                  </div>
                  <span className="font-medium text-gray-900">
                    {att.amount.toFixed(2)} NOK
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Description */}
          {data.description && (
            <>
              <div>
                <h4 className="mb-3 font-semibold text-gray-900">
                  Description
                </h4>
                <p className="text-gray-700 text-sm">{data.description}</p>
              </div>
              <Separator />
            </>
          )}

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-[#3DA9E0]/10 p-4">
            <span className="font-semibold text-gray-900 text-lg">
              Total Amount:
            </span>
            <span className="font-bold text-2xl text-[#3DA9E0]">
              {data.total.toFixed(2)} NOK
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Go Back
          </Button>
          <Button
            className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
            disabled={isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting ? "Submitting..." : "Submit Reimbursement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
