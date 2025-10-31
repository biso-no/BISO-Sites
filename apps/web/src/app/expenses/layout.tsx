import '@/app/globals.css'
import { FormProvider, useFormContext  } from "./[expenseId]/formContext";
import { AuthProvider } from '@/lib/hooks/useAuth';
import UserLayout from '@repo/ui/components/ui/nav';
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider';
import { ExpenseGuidelines } from './expense-guidelines';
import { getLoggedInUser } from '@/lib/actions/user';
import { redirect } from 'next/navigation';
interface LayoutProps {
    children: React.ReactNode
}

export default async function Expenselayout({children}: LayoutProps) {
    const user = await getLoggedInUser()
    if (!user) {
        return redirect('/auth/login')
    }

    return (
        <AuthProvider>
        <FormProvider>
        <UserLayout>
            <OnboardingProvider>
            <ExpenseGuidelines />
            {children}
            </OnboardingProvider>
            </UserLayout>
            </FormProvider>
      </AuthProvider>




    )
}