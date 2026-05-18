export type WeekendSeed = {
  start_date: string;
  end_date: string;
  label: string | null;
  sort_order: number;
};

// All 16 summer 2026 weekends, May 22 – Sep 7
export const SUMMER_2026_WEEKENDS: WeekendSeed[] = [
  { start_date: "2026-05-22", end_date: "2026-05-25", label: "Memorial Day Weekend", sort_order: 1 },
  { start_date: "2026-05-29", end_date: "2026-05-31", label: null, sort_order: 2 },
  { start_date: "2026-06-05", end_date: "2026-06-07", label: null, sort_order: 3 },
  { start_date: "2026-06-12", end_date: "2026-06-14", label: null, sort_order: 4 },
  { start_date: "2026-06-19", end_date: "2026-06-21", label: "Juneteenth Weekend", sort_order: 5 },
  { start_date: "2026-06-26", end_date: "2026-06-28", label: null, sort_order: 6 },
  { start_date: "2026-07-03", end_date: "2026-07-05", label: "Independence Day Weekend", sort_order: 7 },
  { start_date: "2026-07-10", end_date: "2026-07-12", label: null, sort_order: 8 },
  { start_date: "2026-07-17", end_date: "2026-07-19", label: null, sort_order: 9 },
  { start_date: "2026-07-24", end_date: "2026-07-26", label: null, sort_order: 10 },
  { start_date: "2026-07-31", end_date: "2026-08-02", label: null, sort_order: 11 },
  { start_date: "2026-08-07", end_date: "2026-08-09", label: null, sort_order: 12 },
  { start_date: "2026-08-14", end_date: "2026-08-16", label: null, sort_order: 13 },
  { start_date: "2026-08-21", end_date: "2026-08-23", label: null, sort_order: 14 },
  { start_date: "2026-08-28", end_date: "2026-08-30", label: null, sort_order: 15 },
  { start_date: "2026-09-04", end_date: "2026-09-07", label: "Labor Day Weekend", sort_order: 16 },
];

export function formatWeekendDates(start: string, end: string): string {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const startMonth = s.toLocaleDateString("en-US", { month: "short" });
  const endMonth = e.toLocaleDateString("en-US", { month: "short" });
  const startDay = s.getDate();
  const endDay = e.getDate();
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}–${endDay}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
}

export function heatmapColor(available: number, total: number): string {
  if (total === 0) return "bg-gray-100 border-gray-200";
  const pct = available / total;
  if (pct >= 0.7) return "bg-green-100 border-green-300";
  if (pct >= 0.4) return "bg-yellow-100 border-yellow-300";
  return "bg-red-100 border-red-200";
}

export function heatmapTextColor(available: number, total: number): string {
  if (total === 0) return "text-gray-400";
  const pct = available / total;
  if (pct >= 0.7) return "text-green-700";
  if (pct >= 0.4) return "text-yellow-700";
  return "text-red-500";
}

const HOLIDAY_LABELS = new Set([
  "Memorial Day Weekend",
  "Juneteenth Weekend",
  "Independence Day Weekend",
  "Labor Day Weekend",
]);

export function isHoliday(label: string | null): boolean {
  return label != null && HOLIDAY_LABELS.has(label);
}
