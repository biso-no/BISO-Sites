"use client"

import { useMemo, useState, useTransition } from "react"
import { File } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "@repo/ui/components/ui/button"
import { Calendar } from "@repo/ui/components/ui/calendar"
import { Label } from "@repo/ui/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover"
import { exportOrdersToCSV } from "@/app/actions/export-orders"

const DATE_SUMMARY = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

type Preset = {
  id: string
  label: string
  days: number | null
}

const PRESETS: Preset[] = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "all", label: "All time", days: null },
]

export function OrderExportPopover() {
  const defaultPreset = PRESETS[1]
  const [open, setOpen] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>(defaultPreset.id)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(createPresetRange(defaultPreset.days))
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const canExport = selectedPreset === "all" || Boolean(dateRange?.from)

  const rangeSummary = useMemo(() => {
    if (selectedPreset === "all") {
      return "Eksporterer alle ordre."
    }
    if (dateRange?.from && dateRange?.to) {
      return `${DATE_SUMMARY.format(dateRange.from)} – ${DATE_SUMMARY.format(dateRange.to)}`
    }
    if (dateRange?.from) {
      return `${DATE_SUMMARY.format(dateRange.from)}`
    }
    return "Velg eller bruk et hurtigvalg for å bestemme perioden."
  }, [dateRange, selectedPreset])

  const handlePresetSelect = (preset: Preset) => {
    setSelectedPreset(preset.id)
    setMessage(null)
    if (preset.days === null) {
      setDateRange(undefined)
      return
    }
    setDateRange(createPresetRange(preset.days))
  }

  const handleRangeChange = (range?: DateRange) => {
    setSelectedPreset("custom")
    setDateRange(range)
    setMessage(null)
  }

  const handleExport = () => {
    if (!canExport) return

    const { start, end } = resolveRange(selectedPreset, dateRange)
    startTransition(async () => {
      setMessage(null)
      try {
        const result = await exportOrdersToCSV({
          startDate: start?.toISOString(),
          endDate: end?.toISOString(),
        })
        triggerDownload(result.filename, result.content)
        setMessage("Eksport klar – CSV lastet ned.")
        setOpen(false)
      } catch (error) {
        console.error(error)
        setMessage("Kunne ikke eksportere ordre.")
      }
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-sm"
          disabled={isPending}
        >
          <File className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only">Export</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-4" align="end">
        <div>
          <p className="text-sm font-medium">Quick ranges</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant={selectedPreset === preset.id ? "default" : "outline"}
                size="sm"
                type="button"
                className="text-xs"
                onClick={() => handlePresetSelect(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="custom-range" className="text-sm font-medium">Custom range</Label>
          <Calendar
            id="custom-range"
            mode="range"
            numberOfMonths={1}
            selected={dateRange}
            onSelect={handleRangeChange}
            defaultMonth={dateRange?.from}
          />
          <p className="text-xs text-muted-foreground">{rangeSummary}</p>
        </div>

        <Button
          type="button"
          onClick={handleExport}
          disabled={isPending || !canExport}
          className="w-full"
        >
          {isPending ? "Eksporterer…" : "Eksporter CSV"}
        </Button>
        {message && (
          <p className="text-xs text-muted-foreground">
            {message}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

function createPresetRange(days: number | null): DateRange | undefined {
  if (days === null) return undefined
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)
  return { from: start, to: end }
}

function resolveRange(preset: string, range?: DateRange) {
  if (preset === "all") {
    return { start: undefined, end: undefined }
  }
  if (preset !== "custom") {
    const presetConfig = PRESETS.find((p) => p.id === preset)
    if (presetConfig?.days) {
      const presetRange = createPresetRange(presetConfig.days)
      return { start: presetRange?.from, end: presetRange?.to ?? new Date() }
    }
  }
  return {
    start: range?.from ? new Date(range.from.setHours(0, 0, 0, 0)) : undefined,
    end: range?.to ? new Date(range.to.setHours(0, 0, 0, 0)) : range?.from,
  }
}

function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

