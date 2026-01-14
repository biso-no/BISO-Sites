"use client";

import { useState } from "react";
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
import { Textarea } from "@repo/ui/components/ui/textarea";
import { Label } from "@repo/ui/components/ui/label";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { approveProduct, rejectProduct } from "@/app/actions/shop/approval-actions";

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
                size="sm"
                variant="default"
                onClick={handleApprove}
                disabled={isApproving || isRejecting}
                className="bg-green-600 hover:bg-green-700"
            >
                {isApproving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Approve
            </Button>

            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogTrigger asChild>
                    <Button
                        size="sm"
                        variant="destructive"
                        disabled={isApproving || isRejecting}
                    >
                        <XCircle className="h-4 w-4 mr-1" />
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
                                placeholder="Please describe why this product cannot be approved..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRejectDialogOpen(false)}
                            disabled={isRejecting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={isRejecting || !rejectionReason.trim()}
                        >
                            {isRejecting ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <XCircle className="h-4 w-4 mr-2" />
                            )}
                            Reject Product
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
