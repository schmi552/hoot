import { Absence, absenceSpans } from "./schedule/absences";
import type { MeetingOccurrence } from "./schedule/meetings";
import { dateKey, minutesBetween, Span, ymdIn } from "./schedule/schedule";

type Entry = Span & { categoryId: number; description: string; tz: string };

const clock = (tz: string, sec: number) =>
  new Date(sec * 1000).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });

/**
 * The rows of the Entries sheet: Entries, Meetings and Absences, in time order. Date, start and end are read in the zone of
 * each Entry or Meeting; Absences are read in `tz`. A full-day Absence has no start or end. Absence rows are flagged, as they are not logged work.
 */
export function exportRows(entries: Entry[], meetings: MeetingOccurrence[], absences: Absence[], tz: string, categoryName: (id: number) => string) {
  const row = (zone: string, s: Span, category: string, description: string, absence = false, timed = true) => ({
    startUtc: s.startUtc,
    date: dateKey(ymdIn(zone, s.startUtc)),
    start: timed ? clock(zone, s.startUtc) : "",
    end: timed ? clock(zone, s.endUtc) : "",
    minutes: minutesBetween(s.startUtc, s.endUtc),
    category,
    description,
    absence,
  });
  const spans = absenceSpans(absences, tz);
  return [
    ...entries.map((e) => row(e.tz, e, categoryName(e.categoryId), e.description)),
    ...meetings.map((m) => row(m.tz, m, categoryName(m.categoryId), m.title)),
    ...absences.map((a, i) => row(tz, spans[i], "Absence", a.label, true, !a.startDate)),
  ]
    .sort((a, b) => a.startUtc - b.startUtc)
    .map(({ startUtc, ...r }) => r);
}

/** The Workday locations as the sheet shows them: "Home" or "Office". */
export function exportDays(locations: { date: string; location: string }[]) {
  return locations.map((l) => ({ date: l.date, location: l.location === "home" ? "Home" : "Office" }));
}
