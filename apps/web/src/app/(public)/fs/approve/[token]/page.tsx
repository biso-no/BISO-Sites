import { ApprovalClient } from "./approval-client";

export default async function ExpenseApprovalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ intent?: string }>;
}) {
  const { token } = await params;
  const { intent } = await searchParams;

  return <ApprovalClient intent={intent} token={token} />;
}
