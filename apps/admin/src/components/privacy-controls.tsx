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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteUserData } from "@/lib/actions/user";

export function PrivacyControls({ userId }: { userId: string }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestingData, setRequestingData] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const router = useRouter();

  const handleDataRequest = async () => {
    setRequestingData(true);

    try {
      // This would be replaced with your actual API call
      // For example: await requestUserData();

      // Simulate API request
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success("Data Request Submitted", {
        description: "We'll prepare your data and send it to your email within 30 days.",
      });
    } catch (error) {
      toast.error("Data Request Failed", {
        description: "There was a problem requesting your data. Please try again.",
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
    } catch (error) {
      toast.error("Deletion Failed", {
        description: "There was a problem deleting your account. Please try again.",
      });
    } finally {
      setDeletingData(false);
    }
  };

  return (
    <>
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <CardTitle className="flex items-center text-gray-900">
            <Shield className="h-5 w-5 mr-2 text-blue-600" />
            Your Privacy Rights
          </CardTitle>
          <CardDescription className="text-gray-600">
            Under GDPR, you have the right to access, modify, and delete your personal data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="p-3 border border-blue-200 rounded-md bg-blue-50 mb-4">
            <p className="text-sm text-gray-700">
              We process your data in accordance with our{" "}
              <a href="/privacy" className="text-blue-600 hover:underline">
                privacy policy
              </a>{" "}
              and applicable data protection laws. You have the right to access, export, and request
              deletion of your data.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-md hover:bg-gray-50 transition-colors">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Request Your Data</h3>
                <p className="text-xs text-gray-500">
                  Get a copy of all personal data we store about you
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center border-gray-200 text-gray-800 hover:bg-gray-100"
                onClick={handleDataRequest}
                disabled={requestingData}
              >
                {requestingData ? (
                  <div className="h-4 w-4 border-2 border-b-transparent border-gray-400 rounded-full animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export Data
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md hover:bg-gray-50 transition-colors">
              <div>
                <h3 className="text-sm font-medium text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Delete Your Data
                </h3>
                <p className="text-xs text-gray-500">
                  Request permanent deletion of your account and data
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="flex items-center bg-red-600 hover:bg-red-700"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-gray-100 pt-4 text-xs text-gray-500">
          Data requests are processed within 30 days as required by GDPR
        </CardFooter>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white text-gray-900 border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This action cannot be undone. This will permanently delete your account and remove all
              your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t border-gray-100 pt-4">
            <AlertDialogCancel
              disabled={deletingData}
              className="border-gray-200 text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDataDeletion();
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deletingData}
            >
              {deletingData ? (
                <div className="h-4 w-4 border-2 border-b-transparent border-white rounded-full animate-spin mr-2" />
              ) : null}
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
