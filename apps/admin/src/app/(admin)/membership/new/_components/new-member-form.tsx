"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@repo/ui/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/ui/select";
import { Badge } from "@repo/ui/components/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import {
    Loader2,
    Search,
    User,
    UserPlus,
    CreditCard,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    ArrowLeft,
    MapPin,
} from "lucide-react";
import {
    searchStudentInCRM,
    createMembershipForStudent,
    type PurchasableMembership,
    type StudentSearchResult,
    type CreateMemberResult,
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

export function NewMemberForm({ memberships }: NewMemberFormProps) {
    const [step, setStep] = useState<Step>("student");
    const [isPending, startTransition] = useTransition();

    // Student step state
    const [studentId, setStudentId] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<StudentSearchResult | null>(null);
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
                const result = await searchStudentInCRM(studentId);
                setSearchResult(result);
            } catch (error) {
                console.error("Search failed:", error);
                setSearchResult({ found: false, customer: null });
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [studentId]);

    const selectedMembership = memberships.find((m) => m.id === selectedMembershipId);
    const selectedCampus = CAMPUS_OPTIONS.find((c) => c.id === selectedCampusId);

    const canProceedFromStudent = useCallback(() => {
        if (!studentId || studentId.length < 3) return false;
        if (searchResult?.found) return true;
        // New customer needs name
        return firstName.trim().length > 0 && lastName.trim().length > 0;
    }, [studentId, searchResult, firstName, lastName]);

    const canProceedFromMembership = useCallback(() => {
        return selectedMembershipId && selectedCampusId;
    }, [selectedMembershipId, selectedCampusId]);

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
                existingCustomerId: searchResult?.found ? searchResult.customer?.id : undefined,
                firstName: !searchResult?.found ? firstName : undefined,
                lastName: !searchResult?.found ? lastName : undefined,
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
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2">
                {(["student", "membership", "confirm", "result"] as Step[]).map((s, i) => (
                    <div key={s} className="flex items-center">
                        <div
                            className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                                step === s
                                    ? "bg-primary text-primary-foreground"
                                    : i < ["student", "membership", "confirm", "result"].indexOf(step)
                                        ? "bg-emerald-500 text-white"
                                        : "bg-muted text-muted-foreground"
                            )}
                        >
                            {i + 1}
                        </div>
                        {i < 3 && (
                            <div
                                className={cn(
                                    "w-12 h-0.5 mx-1",
                                    i < ["student", "membership", "confirm", "result"].indexOf(step)
                                        ? "bg-emerald-500"
                                        : "bg-muted"
                                )}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Step 1: Student Lookup */}
            {step === "student" && (
                <Card className="glass-panel">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Search className="h-5 w-5" />
                            Find Student
                        </CardTitle>
                        <CardDescription>
                            Enter the student ID to search for existing customers or create a new one.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="studentId">Student ID</Label>
                            <div className="relative">
                                <Input
                                    id="studentId"
                                    placeholder="e.g., s1234567"
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    className="pr-10"
                                />
                                {isSearching && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                            </div>
                        </div>

                        {/* Search Result */}
                        {searchResult && (
                            <div
                                className={cn(
                                    "p-4 rounded-lg border",
                                    searchResult.found
                                        ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                                        : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                                )}
                            >
                                {searchResult.found ? (
                                    <div className="flex items-center gap-3">
                                        <User className="h-5 w-5 text-emerald-600" />
                                        <div>
                                            <p className="font-medium">{searchResult.customer?.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Customer ID: {searchResult.customer?.id} • External ID:{" "}
                                                {searchResult.customer?.externalId}
                                            </p>
                                        </div>
                                        <Badge className="ml-auto bg-emerald-100 text-emerald-700">
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            Found
                                        </Badge>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <UserPlus className="h-5 w-5 text-amber-600" />
                                        <div>
                                            <p className="font-medium">Student not found</p>
                                            <p className="text-sm text-muted-foreground">
                                                Enter the student's name to create a new customer.
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="ml-auto text-amber-600 border-amber-300">
                                            New
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* New Customer Fields */}
                        {searchResult && !searchResult.found && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First Name</Label>
                                    <Input
                                        id="firstName"
                                        placeholder="John"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last Name</Label>
                                    <Input
                                        id="lastName"
                                        placeholder="Doe"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <Button
                                onClick={handleProceedToMembership}
                                disabled={!canProceedFromStudent()}
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
                                value={selectedMembershipId}
                                onValueChange={setSelectedMembershipId}
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
                                value={selectedCampusId}
                                onValueChange={setSelectedCampusId}
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
                            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                                <p className="font-medium">{selectedMembership.name}</p>
                                <div className="flex gap-4 text-sm text-muted-foreground">
                                    <span>Price: {selectedMembership.price} NOK</span>
                                    <span>
                                        Expires: {DATE_FORMATTER.format(new Date(selectedMembership.expiryDate))}
                                    </span>
                                </div>
                                {!selectedMembership.category && (
                                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        No category assigned
                                    </Badge>
                                )}
                            </div>
                        )}

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setStep("student")}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <Button
                                onClick={handleProceedToConfirm}
                                disabled={!canProceedFromMembership()}
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
                            <div className="p-4 rounded-lg bg-muted/50">
                                <h4 className="font-medium mb-2">Student</h4>
                                <div className="text-sm space-y-1">
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
                                            <Badge variant="outline" className="ml-1 text-xs">
                                                New
                                            </Badge>
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-muted/50">
                                <h4 className="font-medium mb-2">Membership</h4>
                                <div className="text-sm space-y-1">
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
                                            DATE_FORMATTER.format(new Date(selectedMembership.expiryDate))}
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">Campus:</span>{" "}
                                        {selectedCampus?.name}
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                                <h4 className="font-medium mb-2">Actions to be performed</h4>
                                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                                    {!searchResult?.found && (
                                        <li>Create customer in 24SevenOffice CRM</li>
                                    )}
                                    {selectedMembership?.category && (
                                        <li>Assign category {selectedMembership.category} to customer</li>
                                    )}
                                    <li>Create invoice for {selectedMembership?.price} NOK ({selectedCampus?.name} department)</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setStep("membership")}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <Button onClick={handleCreateMembership} disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Membership
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 4: Result */}
            {step === "result" && result && (
                <Card
                    className={cn(
                        "glass-panel border-2",
                        result.success
                            ? "border-emerald-500"
                            : "border-rose-500"
                    )}
                >
                    <CardHeader>
                        <CardTitle
                            className={cn(
                                "flex items-center gap-2",
                                result.success ? "text-emerald-600" : "text-rose-600"
                            )}
                        >
                            {result.success ? (
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
                        {result.success ? (
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
                            <Button onClick={handleReset}>
                                {result.success ? "Create Another" : "Try Again"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
