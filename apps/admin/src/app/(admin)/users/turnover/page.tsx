import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { BulkTurnoverForm } from "../components/bulk-turnover-form";
import { BulkUserCreateForm } from "../components/bulk-user-create-form";

export default function TurnoverPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-bold text-2xl">Bulk Operations</h1>
        <p className="text-muted-foreground">
          Create multiple users or perform bulk account turnovers.
        </p>
      </div>

      <Tabs className="w-full" defaultValue="create">
        <TabsList>
          <TabsTrigger value="create">Bulk Create Users</TabsTrigger>
          <TabsTrigger value="turnover">Bulk Turnover</TabsTrigger>
        </TabsList>
        <TabsContent className="mt-6" value="create">
          <BulkUserCreateForm />
        </TabsContent>
        <TabsContent className="mt-6" value="turnover">
          <BulkTurnoverForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
