"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { AlertCircle, Download, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteUserData } from "@/lib/actions/user";

export function PrivacyControls() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestingData, setRequestingData] = useState(false);
  const [deletingData, setDeletingData] = useState(false);

  const handleDataRequest = async () => {
    setRequestingData(true);

    try {
      // This would be replaced with your actual API call
      // For example: await requestUserData();

      // Simulate API request
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success("Data Request Submitted", {
        description:
          "We'll prepare your data and send it to your email within 30 days.",
      });
    } catch (_error) {
      toast.error("Data Request Failed", {
        description:
          "There was a problem requesting your data. Please try again.",
      });
    } finally {
      setRequestingData(false);
    }
  };

  const handleDataDeletion = async () => {
    setDeletingData(true);

    try {
      const deleted = await deleteUserData();

      if (deleted) {
        toast.success("Account Deleted", {
          description: "Your account has been successfully deleted.",
        });
      } else {
        throw new Error("Failed to delete account");
      }

      setDeleteDialogOpen(false);
    } catch (_error) {
      toast.error("Deletion Failed", {
        description:
          "There was a problem deleting your account. Please try again.",
      });
    } finally {
      setDeletingData(false);
    }
  };

  return (
    <>
      <Card className="border border-gray-200 bg-white shadow-sm">
        <CardHeader className="border-gray-100 border-b">
          <CardTitle className="flex items-center text-gray-900">
            <Shield className="mr-2 h-5 w-5 text-blue-600" />
            Your Privacy Rights
          </CardTitle>
          <CardDescription className="text-gray-600">
            Under GDPR, you have the right to access, modify, and delete your
            personal data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
            <p className="text-gray-700 text-sm">
              We process your data in accordance with our{" "}
              <a className="text-blue-600 hover:underline" href="/privacy">
                privacy policy
              </a>{" "}
              and applicable data protection laws. You have the right to access,
              export, and request deletion of your data.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md p-3 transition-colors hover:bg-gray-50">
              <div>
                <h3 className="font-medium text-gray-900 text-sm">
                  Request Your Data
                </h3>
                <p className="text-gray-500 text-xs">
                  Get a copy of all personal data we store about you
                </p>
              </div>
              <Button
                className="flex items-center border-gray-200 text-gray-800 hover:bg-gray-100"
                disabled={requestingData}
                onClick={handleDataRequest}
                size="sm"
                variant="outline"
              >
                {requestingData ? (
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-b-transparent" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export Data
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-md p-3 transition-colors hover:bg-gray-50">
              <div>
                <h3 className="flex items-center font-medium text-red-600 text-sm">
                  <AlertCircle className="mr-1 h-4 w-4" />
                  Delete Your Data
                </h3>
                <p className="text-gray-500 text-xs">
                  Request permanent deletion of your account and data
                </p>
              </div>
              <Button
                className="flex items-center bg-red-600 hover:bg-red-700"
                onClick={() => setDeleteDialogOpen(true)}
                size="sm"
                variant="destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-gray-100 border-t pt-4 text-gray-500 text-xs">
          Data requests are processed within 30 days as required by GDPR
        </CardFooter>
      </Card>

      <AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <AlertDialogContent className="border border-gray-200 bg-white text-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This action cannot be undone. This will permanently delete your
              account and remove all your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-gray-100 border-t pt-4">
            <AlertDialogCancel
              className="border-gray-200 text-gray-700 hover:bg-gray-100"
              disabled={deletingData}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deletingData}
              onClick={(e) => {
                e.preventDefault();
                handleDataDeletion();
              }}
            >
              {deletingData ? (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" />
              ) : null}
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
