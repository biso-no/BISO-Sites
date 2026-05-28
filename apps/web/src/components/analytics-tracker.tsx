interface AnalyticsTrackerProps {
  locale: string;
}

// Analytics ingestion is disabled until a proper analytics service is wired
// up. Keep the component as a noop so the layout import / prop contract
// stays stable and the future replacement only has to swap this file.
export function AnalyticsTracker(_props: AnalyticsTrackerProps) {
  return null;
}
