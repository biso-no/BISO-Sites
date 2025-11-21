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

interface SummaryDialogProps {
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
}

export function SummaryDialog({
  open,
  onOpenChange,
  data,
  onSubmit,
  isSubmitting,
}: SummaryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Your Reimbursement</DialogTitle>
          <DialogDescription>Please review all details before submitting</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact Info */}
          <div>
            <h4 className="mb-3 text-gray-900 font-semibold">Contact Information</h4>
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
            <h4 className="mb-3 text-gray-900 font-semibold">Assignment</h4>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-[#3DA9E0]" />
              <span className="text-gray-900">
                {data.campus} - {data.department}
              </span>
            </div>
          </div>

          <Separator />

          {/* Receipts */}
          <div>
            <h4 className="mb-3 text-gray-900 font-semibold">
              Receipts ({data.attachments.length})
            </h4>
            <div className="space-y-2">
              {data.attachments.map((att, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded"
                >
                  <div>
                    <p className="text-gray-900">{att.description}</p>
                    <p className="text-gray-500 text-xs">{att.date}</p>
                  </div>
                  <span className="text-gray-900 font-medium">{att.amount.toFixed(2)} NOK</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Description */}
          {data.description && (
            <>
              <div>
                <h4 className="mb-3 text-gray-900 font-semibold">Description</h4>
                <p className="text-sm text-gray-700">{data.description}</p>
              </div>
              <Separator />
            </>
          )}

          {/* Total */}
          <div className="flex justify-between items-center p-4 bg-[#3DA9E0]/10 rounded-lg">
            <span className="text-lg font-semibold text-gray-900">Total Amount:</span>
            <span className="text-2xl font-bold text-[#3DA9E0]">{data.total.toFixed(2)} NOK</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Go Back
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white"
          >
            {isSubmitting ? "Submitting..." : "Submit Reimbursement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
