"use client";
import { signOut } from "@/lib/actions/user";
import { Button } from "@repo/ui/components/ui/button";

export function SignOutButton() {

    const handleSignOut = async () => {
        await signOut()
    }

    return (
        <Button onClick={handleSignOut}>Sign out</Button>
    );
}