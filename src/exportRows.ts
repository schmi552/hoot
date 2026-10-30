import { dateKey, minutesBetween, Span, ymdIn } from "./schedule/schedule";

type Entry = Span & { categoryId: number; description: string; tz: string };

const clock = (tz: string, sec: number) =>
  new Date(sec * 1000).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });

/** The rows of the Entries sheet. Date, start and end are read in the zone of each Entry. */
export function exportRows(entries: Entry[], categoryName: (id: number) => string) {
  return entries.map((e) => ({
    date: dateKey(ymdIn(e.tz, e.startUtc)),
    start: clock(e.tz, e.startUtc),
    end: clock(e.tz, e.endUtc),
    minutes: minutesBetween(e.startUtc, e.endUtc),
    category: categoryName(e.categoryId),
    description: e.description,
  }));
}

/** The Workday locations as the sheet shows them: "Home" or "Office". */
export function exportDays(locations: { date: string; location: string }[]) {
  return locations.map((l) => ({ date: l.date, location: l.location === "home" ? "Home" : "Office" }));
}
