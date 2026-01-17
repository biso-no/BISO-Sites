"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  approveProduct,
  rejectProduct,
} from "@/app/actions/shop/approval-actions";

type ApprovalActionsProps = {
  productId: string;
};

export function ApprovalActions({ productId }: ApprovalActionsProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await approveProduct(productId);
      toast.success("Product approved and published");
    } catch (error) {
      console.error(error);
      toast.error("Failed to approve product");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setIsRejecting(true);
    try {
      await rejectProduct(productId, rejectionReason);
      toast.success("Product rejected and returned to draft");
      setRejectDialogOpen(false);
      setRejectionReason("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to reject product");
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        className="bg-green-600 hover:bg-green-700"
        disabled={isApproving || isRejecting}
        onClick={handleApprove}
        size="sm"
        variant="default"
      >
        {isApproving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="mr-1 h-4 w-4" />
        )}
        Approve
      </Button>

      <Dialog onOpenChange={setRejectDialogOpen} open={rejectDialogOpen}>
        <DialogTrigger asChild>
          <Button
            disabled={isApproving || isRejecting}
            size="sm"
            variant="destructive"
          >
            <XCircle className="mr-1 h-4 w-4" />
            Reject
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Product</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this product. The department will
              be able to see this feedback and make corrections.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please describe why this product cannot be approved..."
                rows={4}
                value={rejectionReason}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={isRejecting}
              onClick={() => setRejectDialogOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isRejecting || !rejectionReason.trim()}
              onClick={handleReject}
              variant="destructive"
            >
              {isRejecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Reject Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
