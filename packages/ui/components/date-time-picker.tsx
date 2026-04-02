"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Calendar } from "@repo/ui/components/ui/calendar";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";
import { CalendarIcon, X } from "lucide-react";
import { useState } from "react";

export type DateTimePickerProps = {
  value?: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  readOnly?: boolean;
};

/** Parse "yyyy-MM-dd HH:mm" string to Date */
function parseValue(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const [datePart, timePart] = value.split(" ");
  if (!datePart) return undefined;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = (timePart ?? "00:00").split(":").map(Number);
  if (!year || !month || !day) return undefined;
  const d = new Date(year, (month ?? 1) - 1, day, hours ?? 0, minutes ?? 0, 0, 0);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Format Date to "yyyy-MM-dd HH:mm" */
function formatValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Format Date for display: "12 Jan 2026, 09:00" */
function formatDisplay(d: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateTimePicker({
  value,
  onChange,
  label,
  readOnly,
}: DateTimePickerProps) {
  const parsed = parseValue(value);
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState<string>(
    parsed
      ? `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`
      : "09:00"
  );

  function handleDaySelect(day: Date | undefined) {
    if (!day) {
      onChange(null);
      return;
    }
    const [hours, minutes] = time.split(":").map(Number);
    day.setHours(hours ?? 9, minutes ?? 0, 0, 0);
    onChange(formatValue(day));
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setTime(next);
    if (!parsed) return;
    const [hours, minutes] = next.split(":").map(Number);
    if (hours === undefined || minutes === undefined) return;
    const updated = new Date(parsed);
    updated.setHours(hours, minutes, 0, 0);
    onChange(formatValue(updated));
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setTime("09:00");
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <Popover open={open} onOpenChange={readOnly ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <Button
            className={cn(
              "w-full justify-start text-left font-normal",
              !parsed && "text-muted-foreground"
            )}
            disabled={readOnly}
            variant="outline"
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">
              {parsed ? formatDisplay(parsed) : "Pick a date & time"}
            </span>
            {parsed && !readOnly && (
              <X
                className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            initialFocus
            mode="single"
            onSelect={handleDaySelect}
            selected={parsed}
          />
          <div className="border-t px-3 pb-3 pt-2">
            <Label className="mb-1.5 block text-xs text-muted-foreground">
              Time
            </Label>
            <Input
              className="h-8 text-sm"
              onChange={handleTimeChange}
              type="time"
              value={time}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
