"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import {
  Building,
  Calendar,
  CreditCard,
  DollarSign,
  FileText,
  MapPin,
  Banknote
} from "lucide-react";
import { useFormContext } from "./formContext";
import { format } from "date-fns";
import { ChevronLeft } from "lucide-react";
import { Progress } from "@repo/ui/components/ui/progress";
import { Button } from "@repo/ui/components/ui/button";
import { handleSubmit } from "./handleSubmit";
import { useRouter } from "next/navigation"

export default function ExpenseOverview(expenseId) {
  const formContext = useFormContext();
  const step = formContext.step;
  const nextStep = formContext.nextStep;
  const updateFormData = formContext.updateFormData;
  const prevStep = formContext.prevStep;
  const formData = formContext.formData;
  const router = useRouter()

  // Event handler for form submission
  const onSubmit = async () => {
    try {
      console.log("Submitting form...");
      await handleSubmit(formData, updateFormData,expenseId);
      router.push(`../expenses`)
      console.log("Form submitted successfully.");
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <CardContent>
        <Progress value={step * 25} className="w-full mb-6" />

        {/* Expense Overview Section */}
        <Card className="shadow-lg">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="flex items-center text-2xl">
              <FileText className="mr-2" />
              Expense Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoItem
                icon={<CreditCard />}
                label="Bank Account"
                value={formData.bank_account || "N/A"}
              />
              <InfoItem
                icon={<MapPin />}
                label="Campus"
                value={formData.campus}
              />
              <InfoItem
                icon={<Building />}
                label="Department"
                value={formData.department}
              />
              <InfoItem
                icon={<FileText />}
                label="Description"
                value={formData.description || "N/A"}
              />
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between items-center pt-2 text-lg font-semibold">
              <span className="flex items-center">
                <Banknote className="mr-2" />
                Total Amount:
              </span>
              <span>{formData.total} kr</span>
            </div>
          </CardContent>
        </Card>

        {/* Expense Attachments Section */}
        <Card className="shadow-lg">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="flex items-center text-2xl">
              <FileText className="mr-2" />
              Expense Attachments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {formData.expense_attachments.length > 0 ? (
              <div className="space-y-4">
                {formData.expense_attachments.map((attachment, index) => (
                  <Card key={index} className="bg-secondary">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InfoItem
                          icon={<DollarSign />}
                          label="Amount"
                          value={`${attachment.amount} kr`}
                        />
                        <InfoItem
                          icon={<Calendar />}
                          label="Date"
                          value={format(
                            new Date(attachment.date),
                            "MMMM d, yyyy"
                          )}
                        />
                        <InfoItem
                          icon={<FileText />}
                          label="Description"
                          value={attachment.description}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500">No attachments found.</p>
            )}
          </CardContent>
        </Card>
      </CardContent>

      <CardFooter className="flex justify-between">
        {step > 1 && (
          <Button type="button" variant="outline" onClick={prevStep}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
        )}
        {step < 5 && (
          <Button
            type="button"
            className="ml-auto"
            onClick={onSubmit} // Calls onSubmit when the button is clicked
          >
            Submit
          </Button>
        )}
      </CardFooter>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center space-x-2">
      {icon}
      <span className="font-medium">{label}:</span>
      <span className="text-gray-600">{value}</span>
    </div>
  );
}
