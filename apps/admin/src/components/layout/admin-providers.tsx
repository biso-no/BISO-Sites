"use client";
import "@assistant-ui/styles/index.css";
import "@assistant-ui/styles/markdown.css";
import { AssistantRuntimeProvider, useAssistantRuntime, useAssistantTool, makeAssistantToolUI } from "@assistant-ui/react";
import { AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { z } from "zod";

export const AdminProviders = ({ children }: { children: React.ReactNode }) => {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/admin-assistant",
    }),
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AdminAssistantContext />
      {children}
    </AssistantRuntimeProvider>
  );
};

function AdminAssistantContext() {
  const pathname = usePathname();
  const runtime = useAssistantRuntime();

  const ctx = { role: "Admin", counts: { products: 0, pendingExpenses: 0 } };

  const activeConfig = useMemo(() => {
    const mapping: Record<string, { instructions: (c: typeof ctx) => string; tools: string[] }> = {
      "/admin/shop/products": {
        instructions: (c) => `You are the Products copilot. Role=${c.role}.` ,
        tools: ["createProduct", "editProduct", "deleteProduct", "bulkUpdateProducts"],
      },
      "/admin/expenses": {
        instructions: (c) => `You are the Expenses copilot. Role=${c.role}. Pending=${c.counts.pendingExpenses}.`,
        tools: ["approveExpense", "rejectExpense", "viewReceipt"],
      },
      "/admin/jobs": {
        instructions: (c) => `You are the Jobs copilot. Role=${c.role}.`,
        tools: ["reviewCandidate"],
      },
    };
    const match = Object.keys(mapping).find((p) => pathname?.startsWith(p));
    return match ? mapping[match] : null;
  }, [pathname]);

  useEffect(() => {
    if (!activeConfig) return;
    const dispose = runtime.registerModelContextProvider({
      getModelContext: () => ({
        instructions: activeConfig.instructions(ctx),
        priority: 50,
      }),
    });
    return dispose;
  }, [activeConfig, runtime]);

  // Register example tools conditionally
  useAssistantTool({
    toolName: "approveExpense",
    description: "Approve an expense by ID",
    parameters: z.object({ expenseId: z.string(), note: z.string().optional() }),
    disabled: !Boolean(activeConfig?.tools.includes("approveExpense")),
    execute: async ({ expenseId, note }) => {
      const res = await fetch("/api/expense/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseId, note }),
      });
      if (!res.ok) throw new Error(`Approve failed: ${res.status}`);
      return await res.json();
    },
  });

  // Minimal Tool UI example
  makeAssistantToolUI<{ expenseId: string; note?: string }, { status: string; approvedBy: string; at: string}>({
    toolName: "approveExpense",
    render: ({ args, status, result }) => {
      if (status.type === "running") return <div className="text-sm">Approving expense {args.expenseId}…</div>;
      if (status.type === "incomplete" && status.reason === "error") return <div className="text-sm text-red-500">Failed to approve.</div>;
      if (result) return <div className="text-sm text-green-600">Approved by {result.approvedBy} at {new Date(result.at).toLocaleString()}</div>;
      return null;
    },
  });

  return null;
}
