import { dayBoundsIn, Span, Ymd } from "./schedule";

export const ABSENCE_KINDS = ["Vacation", "Sick", "Holiday", "Other"] as const;
export type AbsenceKind = (typeof ABSENCE_KINDS)[number];

/** Time away. Full-day: local dates "YYYY-MM-DD", both included. Part-day: UTC instants and the zone they were entered in. */
export type Absence = {
  id: number; kind: AbsenceKind; label: string;
  startDate: string | null; endDate: string | null;
  startUtc: number | null; endUtc: number | null; tz: string | null;
};

const ymd = (date: string): Ymd => {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
};

/** The spans the Absences cover, as instants. A full-day Absence covers whole days in `tz`, the zone of the settings. */
export function absenceSpans(all: Absence[], tz: string): Span[] {
  return all.map((a) =>
    a.startDate
      ? { startUtc: dayBoundsIn(tz, ymd(a.startDate))[0], endUtc: dayBoundsIn(tz, ymd(a.endDate!))[1] }
      : { startUtc: a.startUtc!, endUtc: a.endUtc! },
  );
}

/** The text for an Absence. Full-day: the kind, then the label if set. Part-day: the label if set, else the kind. */
export function absenceTitle(a: Absence): string {
  if (a.startDate) return a.label ? `${a.kind}: ${a.label}` : a.kind;
  return a.label || a.kind;
}
