import type { Absence } from "./schedule/absences";
import type { MeetingOccurrence } from "./schedule/meetings";
import { dateKey, instantAt, minutesBetween, Span, ymdIn } from "./schedule/schedule";

type Entry = Span & { categoryId: number; description: string; tz: string };

const clock = (tz: string, sec: number) =>
  new Date(sec * 1000).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });

export const ABSENCE_CATEGORY = "Absence (not worked)";

/** The dates "YYYY-MM-DD" from `from` to `to`, both included. */
function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/**
 * The rows of the Entries sheet: Entries, Meetings and Absences, in time order. Date, start and end are read in the zone of
 * each Entry or Meeting; Absences are read in `tz`. Absence rows are flagged, as they are not logged work, and the sheet leaves their hours empty.
 * A full-day Absence gets one row per day inside `range` (dates, both included), with no start or end.
 */
export function exportRows(entries: Entry[], meetings: MeetingOccurrence[], absences: Absence[], tz: string, range: { from: string; to: string }, categoryName: (id: number) => string) {
  const row = (zone: string, s: Span, category: string, description: string, absence = false) => ({
    startUtc: s.startUtc,
    date: dateKey(ymdIn(zone, s.startUtc)),
    start: clock(zone, s.startUtc),
    end: clock(zone, s.endUtc),
    minutes: minutesBetween(s.startUtc, s.endUtc),
    category,
    description,
    absence,
  });
  const absenceRows = absences.flatMap((a) => {
    if (a.startDate) {
      return datesBetween(a.startDate, a.endDate!)
        .filter((date) => date >= range.from && date <= range.to)
        .map((date) => {
          const [y, m, d] = date.split("-").map(Number);
          return { startUtc: instantAt(tz, { y, m, d }), date, start: "", end: "", minutes: 0, category: ABSENCE_CATEGORY, description: a.label, absence: true };
        });
    }
    const r = row(tz, { startUtc: a.startUtc!, endUtc: a.endUtc! }, ABSENCE_CATEGORY, a.label, true);
    return r.date >= range.from && r.date <= range.to ? [r] : [];
  });
  return [
    ...entries.map((e) => row(e.tz, e, categoryName(e.categoryId), e.description)),
    ...meetings.map((m) => row(m.tz, m, categoryName(m.categoryId), m.title)),
    ...absenceRows,
  ]
    .sort((a, b) => a.startUtc - b.startUtc)
    .map(({ startUtc, ...r }) => r);
}

/** The Workday locations as the sheet shows them: "Home" or "Office". */
export function exportDays(locations: { date: string; location: string }[]) {
  return locations.map((l) => ({ date: l.date, location: l.location === "home" ? "Home" : "Office" }));
}
