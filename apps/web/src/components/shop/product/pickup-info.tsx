import { Card } from "@repo/ui/components/ui/card";
import { MapPin } from "lucide-react";

export function PickupInfo() {
  return (
    <Card className="border-0 bg-blue-50 p-6 shadow-lg">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h4 className="mb-2 font-semibold text-foreground">Campus Pickup</h4>
          <p className="mb-2 text-muted-foreground text-sm">
            All products are available for pickup at the BISO office. No
            shipping, no hassle!
          </p>
          <div className="text-muted-foreground text-sm">
            <strong>BISO Office:</strong> Main Building, Ground Floor
            <br />
            <strong>Hours:</strong> Monday-Friday, 10:00-16:00
            <br />
            <strong>Pickup:</strong> Within 5 working days of purchase
          </div>
        </div>
      </div>
    </Card>
  );
}
