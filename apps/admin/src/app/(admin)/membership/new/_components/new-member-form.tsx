"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { cn } from "@repo/ui/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CreditCard,
  Loader2,
  MapPin,
  Search,
  User,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  type CreateMemberResult,
  createMembershipForStudent,
  type PurchasableMembership,
  type StudentSearchResult,
  searchStudentInCRM,
} from "@/app/actions/new-member";

interface NewMemberFormProps {
  memberships: PurchasableMembership[];
}

type Step = "student" | "membership" | "confirm" | "result";

const DATE_FORMATTER = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// Campus options matching 24SevenOffice department IDs
const CAMPUS_OPTIONS = [
  { id: "1", name: "Oslo" },
  { id: "2", name: "Bergen" },
  { id: "3", name: "Trondheim" },
  { id: "4", name: "Stavanger" },
  { id: "5", name: "National" },
];

const STEP_ORDER: Step[] = ["student", "membership", "confirm", "result"];

function getStepClassName(
  stepValue: Step,
  currentStep: Step,
  stepIndex: number
): string {
  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  if (currentStep === stepValue) {
    return "bg-primary text-primary-foreground";
  }
  if (stepIndex < currentStepIndex) {
    return "bg-emerald-500 text-white";
  }
  return "bg-muted text-muted-foreground";
}

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const currentStepIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-2">
      {STEP_ORDER.map((s, i) => (
        <div className="flex items-center" key={s}>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full font-medium text-sm",
              getStepClassName(s, currentStep, i)
            )}
          >
            {i + 1}
          </div>
          {i < 3 && (
            <div
              className={cn(
                "mx-1 h-0.5 w-12",
                i < currentStepIndex ? "bg-emerald-500" : "bg-muted"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function SearchResultDisplay({
  searchResult,
}: {
  searchResult: StudentSearchResult;
}) {
  if (searchResult.found) {
    return (
      <div className="flex items-center gap-3">
        <User className="h-5 w-5 text-emerald-600" />
        <div>
          <p className="font-medium">{searchResult.customer?.name}</p>
          <p className="text-muted-foreground text-sm">
            Customer ID: {searchResult.customer?.id} • External ID:{" "}
            {searchResult.customer?.externalId}
          </p>
        </div>
        <Badge className="ml-auto bg-emerald-100 text-emerald-700">
          <CheckCircle className="mr-1 h-3 w-3" />
          Found
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <UserPlus className="h-5 w-5 text-amber-600" />
      <div>
        <p className="font-medium">Student not found</p>
        <p className="text-muted-foreground text-sm">
          Enter the student's name to create a new customer.
        </p>
      </div>
      <Badge
        className="ml-auto border-amber-300 text-amber-600"
        variant="outline"
      >
        New
      </Badge>
    </div>
  );
}

function ResultCard({
  result,
  onReset,
}: {
  result: CreateMemberResult;
  onReset: () => void;
}) {
  const isSuccess = result.success;

  return (
    <Card
      className={cn(
        "glass-panel border-2",
        isSuccess ? "border-emerald-500" : "border-rose-500"
      )}
    >
      <CardHeader>
        <CardTitle
          className={cn(
            "flex items-center gap-2",
            isSuccess ? "text-emerald-600" : "text-rose-600"
          )}
        >
          {isSuccess ? (
            <>
              <CheckCircle className="h-5 w-5" />
              Membership Created Successfully
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5" />
              Failed to Create Membership
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isSuccess ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Customer:</span>{" "}
              {result.customerName} (ID: {result.customerId})
            </p>
            {result.categoryAssigned && (
              <p>
                <span className="text-muted-foreground">Category:</span>{" "}
                {result.categoryAssigned}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Invoice Order ID:</span>{" "}
              {result.invoiceOrderId}
            </p>
          </div>
        ) : (
          <p className="text-rose-600">{result.error}</p>
        )}

        <div className="flex justify-center">
          <Button onClick={onReset}>
            {isSuccess ? "Create Another" : "Try Again"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function NewMemberForm({ memberships }: NewMemberFormProps) {
  const [step, setStep] = useState<Step>("student");
  const [isPending, startTransition] = useTransition();

  // Student step state
  const [studentId, setStudentId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<StudentSearchResult | null>(
    null
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Membership step state
  const [selectedMembershipId, setSelectedMembershipId] = useState<string>("");
  const [selectedCampusId, setSelectedCampusId] = useState<string>("");

  // Result state
  const [result, setResult] = useState<CreateMemberResult | null>(null);

  // Debounced search
  useEffect(() => {
    if (studentId.length < 3) {
      setSearchResult(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const searchData = await searchStudentInCRM(studentId);
        setSearchResult(searchData);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResult({ found: false, customer: null });
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [studentId]);

  const selectedMembership = memberships.find(
    (m) => m.id === selectedMembershipId
  );
  const selectedCampus = CAMPUS_OPTIONS.find((c) => c.id === selectedCampusId);

  const canProceedFromStudent = useCallback(() => {
    if (!studentId || studentId.length < 3) {
      return false;
    }
    if (searchResult?.found) {
      return true;
    }
    // New customer needs name
    return firstName.trim().length > 0 && lastName.trim().length > 0;
  }, [studentId, searchResult, firstName, lastName]);

  const canProceedFromMembership = useCallback(
    () => selectedMembershipId && selectedCampusId,
    [selectedMembershipId, selectedCampusId]
  );

  const handleProceedToMembership = () => {
    if (canProceedFromStudent()) {
      setStep("membership");
    }
  };

  const handleProceedToConfirm = () => {
    if (canProceedFromMembership()) {
      setStep("confirm");
    }
  };

  const handleCreateMembership = () => {
    startTransition(async () => {
      const createResult = await createMembershipForStudent({
        studentId,
        existingCustomerId: searchResult?.found
          ? searchResult.customer?.id
          : undefined,
        firstName: searchResult?.found ? undefined : firstName,
        lastName: searchResult?.found ? undefined : lastName,
        membershipId: selectedMembershipId,
        campusId: selectedCampusId,
      });
      setResult(createResult);
      setStep("result");
    });
  };

  const handleReset = () => {
    setStep("student");
    setStudentId("");
    setSearchResult(null);
    setFirstName("");
    setLastName("");
    setSelectedMembershipId("");
    setSelectedCampusId("");
    setResult(null);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <StepIndicator currentStep={step} />

      {/* Step 1: Student Lookup */}
      {step === "student" && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Find Student
            </CardTitle>
            <CardDescription>
              Enter the student ID to search for existing customers or create a
              new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID</Label>
              <div className="relative">
                <Input
                  className="pr-10"
                  id="studentId"
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g., s1234567"
                  value={studentId}
                />
                {isSearching && (
                  <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Search Result */}
            {searchResult && (
              <div
                className={cn(
                  "rounded-lg border p-4",
                  searchResult.found
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20"
                    : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
                )}
              >
                <SearchResultDisplay searchResult={searchResult} />
              </div>
            )}

            {/* New Customer Fields */}
            {searchResult && !searchResult.found && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    value={firstName}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    value={lastName}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                disabled={!canProceedFromStudent()}
                onClick={handleProceedToMembership}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Membership & Campus */}
      {step === "membership" && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Select Membership & Campus
            </CardTitle>
            <CardDescription>
              Choose the membership product and campus for this student.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Membership Product</Label>
              <Select
                onValueChange={setSelectedMembershipId}
                value={selectedMembershipId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a membership..." />
                </SelectTrigger>
                <SelectContent>
                  {memberships.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <span>{m.name}</span>
                        <span className="text-muted-foreground">
                          - {m.price} NOK
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Campus
              </Label>
              <Select
                onValueChange={setSelectedCampusId}
                value={selectedCampusId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a campus..." />
                </SelectTrigger>
                <SelectContent>
                  {CAMPUS_OPTIONS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedMembership && (
              <div className="space-y-2 rounded-lg bg-muted/50 p-4">
                <p className="font-medium">{selectedMembership.name}</p>
                <div className="flex gap-4 text-muted-foreground text-sm">
                  <span>Price: {selectedMembership.price} NOK</span>
                  <span>
                    Expires:{" "}
                    {DATE_FORMATTER.format(
                      new Date(selectedMembership.expiryDate)
                    )}
                  </span>
                </div>
                {!selectedMembership.category && (
                  <Badge
                    className="border-amber-300 text-amber-600"
                    variant="outline"
                  >
                    <AlertCircle className="mr-1 h-3 w-3" />
                    No category assigned
                  </Badge>
                )}
              </div>
            )}

            <div className="flex justify-between">
              <Button onClick={() => setStep("student")} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                disabled={!canProceedFromMembership()}
                onClick={handleProceedToConfirm}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {step === "confirm" && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Confirm Details
            </CardTitle>
            <CardDescription>
              Review the details before creating the membership.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <h4 className="mb-2 font-medium">Student</h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Student ID:</span>{" "}
                    {studentId}
                  </p>
                  {searchResult?.found ? (
                    <p>
                      <span className="text-muted-foreground">Name:</span>{" "}
                      {searchResult.customer?.name}
                    </p>
                  ) : (
                    <p>
                      <span className="text-muted-foreground">Name:</span>{" "}
                      (Student) {lastName}, {firstName}{" "}
                      <Badge className="ml-1 text-xs" variant="outline">
                        New
                      </Badge>
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-4">
                <h4 className="mb-2 font-medium">Membership</h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Product:</span>{" "}
                    {selectedMembership?.name}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Price:</span>{" "}
                    {selectedMembership?.price} NOK
                  </p>
                  <p>
                    <span className="text-muted-foreground">Expires:</span>{" "}
                    {selectedMembership &&
                      DATE_FORMATTER.format(
                        new Date(selectedMembership.expiryDate)
                      )}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Campus:</span>{" "}
                    {selectedCampus?.name}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <h4 className="mb-2 font-medium">Actions to be performed</h4>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
                  {!searchResult?.found && (
                    <li>Create customer in 24SevenOffice CRM</li>
                  )}
                  {selectedMembership?.category && (
                    <li>
                      Assign category {selectedMembership.category} to customer
                    </li>
                  )}
                  <li>
                    Create invoice for {selectedMembership?.price} NOK (
                    {selectedCampus?.name} department)
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex justify-between">
              <Button onClick={() => setStep("membership")} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button disabled={isPending} onClick={handleCreateMembership}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Membership
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Result */}
      {step === "result" && result && (
        <ResultCard onReset={handleReset} result={result} />
      )}
    </div>
  );
}
