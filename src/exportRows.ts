import { type Absence, absenceTitle } from "./schedule/absences";
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
export function exportRows(entries: Entry[], meetings: MeetingOccurrence[], absences: Absence[], tz: string, range: { from: string; to: string }, category: (id: number) => { code: string; name: string }) {
  const row = (zone: string, s: Span, c: { code: string; name: string }, description: string, absence = false) => ({
    startUtc: s.startUtc,
    date: dateKey(ymdIn(zone, s.startUtc)),
    start: clock(zone, s.startUtc),
    end: clock(zone, s.endUtc),
    minutes: minutesBetween(s.startUtc, s.endUtc),
    code: c.code,
    category: c.name,
    description,
    absence,
  });
  const NONE = { code: "", name: "" };
  const ABSENCE = { code: "", name: ABSENCE_CATEGORY };
  const absenceRows = absences.flatMap((a) => {
    if (a.startDate) {
      return datesBetween(a.startDate, a.endDate!)
        .filter((date) => date >= range.from && date <= range.to)
        .map((date) => {
          const [y, m, d] = date.split("-").map(Number);
          return { startUtc: instantAt(tz, { y, m, d }), date, start: "", end: "", minutes: 0, code: "", category: ABSENCE_CATEGORY, description: absenceTitle(a), absence: true };
        });
    }
    const r = row(tz, { startUtc: a.startUtc!, endUtc: a.endUtc! }, ABSENCE, absenceTitle(a), true);
    return r.date >= range.from && r.date <= range.to ? [r] : [];
  });
  return [
    ...entries.map((e) => row(e.tz, e, category(e.categoryId), e.description)),
    ...meetings.map((m) => row(m.tz, m, m.categoryId === null ? NONE : category(m.categoryId), m.title)),
    ...absenceRows,
  ]
    .sort((a, b) => a.startUtc - b.startUtc)
    .map(({ startUtc, ...r }) => r);
}

/** The Workday locations as the sheet shows them: "Home" or "Office". */
export function exportDays(locations: { date: string; location: string }[]) {
  return locations.map((l) => ({ date: l.date, location: l.location === "home" ? "Home" : "Office" }));
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const monthRange = (y: number, m: number) => ({ from: `${y}-${pad(m)}-01`, to: iso(Date.UTC(y, m, 0)) }); // m is 1 to 12; day 0 of the next month is the last day

/** The four presets of the export dialog, for the day `today` ("YYYY-MM-DD"). Weeks run from Monday to Sunday. */
export function exportPresets(today: string) {
  const t = Date.parse(today);
  const monday = t - ((new Date(t).getUTCDay() + 6) % 7) * 86_400_000;
  const [y, m] = today.split("-").map(Number);
  return {
    "This week": { from: iso(monday), to: iso(monday + 6 * 86_400_000) },
    "Last week": { from: iso(monday - 7 * 86_400_000), to: iso(monday - 86_400_000) },
    "This month": monthRange(y, m),
    "Last month": m === 1 ? monthRange(y - 1, 12) : monthRange(y, m - 1),
  };
}

/** `hoot_YYYY-MM.xlsx` for a full month, else `hoot_{from}_{to}.xlsx`. */
export function exportFileName(from: string, to: string) {
  const [y, m] = from.split("-").map(Number);
  const month = monthRange(y, m);
  return from === month.from && to === month.to ? `hoot_${from.slice(0, 7)}.xlsx` : `hoot_${from}_${to}.xlsx`;
}

/** "2026-10-01" to "01.10.2026". */
export const formatDmy = (day: string) => day.split("-").reverse().join(".");

/** "1.10.2026" or "01.10.2026" to "2026-10-01"; null if the text is not a real date. */
export function parseDmy(text: string) {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const day = `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return iso(Date.UTC(+m[3], +m[2] - 1, +m[1])) === day ? day : null; // Date.UTC rolls 31 February to March, so the round trip fails
}
