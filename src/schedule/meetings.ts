import { RRuleTemporal } from "rrule-temporal";
import { Temporal } from "temporal-polyfill";
import type { Span } from "./schedule";

/** A Meeting or a recurring Meeting. `startLocal` is "YYYY-MM-DDTHH:MM" on the wall clock of `tz`; `rrule` is null for a one-off. */
export type MeetingSeries = {
  id: number; categoryId: number | null; title: string; startLocal: string; durationMinutes: number; tz: string; rrule: string | null;
  /** The `.ics` file name; "" for an old import that did not keep it; null for a Meeting made by hand. */
  sourceFile: string | null;
};
/** Where a series came from, for the edit form. Empty for a Meeting made by hand. */
export const sourceText = (s: Pick<MeetingSeries, "sourceFile">) => (s.sourceFile === null ? "" : s.sourceFile ? `from ${s.sourceFile}` : "from .ics file");
/** One changed occurrence of a series, found by its original wall-clock start. A skip removes it; an override replaces the fields that are set. */
export type MeetingException = {
  seriesId: number; originalStartLocal: string; kind: "skip" | "override";
  startLocal: string | null; durationMinutes: number | null; title: string | null; categoryId: number | null;
};
export type MeetingOccurrence = Span & { seriesId: number; categoryId: number | null; title: string; tz: string; originalStartLocal: string };

export type Repeat = "none" | "daily" | "weekdays" | "weekly" | "custom" | "monthly";
export const REPEATS: Repeat[] = ["none", "daily", "weekdays", "weekly", "custom", "monthly"];
/** The RRULE codes of the days of the week, Monday first. */
export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

const OVERRIDE_REACH = 14 * 86_400; // how far an override may move an occurrence and still show

/** The RRULE of a Repeat choice, or null for "none". "custom" repeats every week on `days` (RRULE codes, in any order). */
export function ruleFor(repeat: Repeat, days: string[] = []): string | null {
  const custom = `FREQ=WEEKLY;BYDAY=${WEEKDAYS.filter((d) => days.includes(d)).join(",")}`;
  return { none: null, daily: "FREQ=DAILY", weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", weekly: "FREQ=WEEKLY", custom, monthly: "FREQ=MONTHLY" }[repeat];
}

const DAY_NAMES: Record<string, string> = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };

/** A repeat rule as text. A rule that the app cannot describe (an interval, a count, an end date …) gives "This Meeting repeats.". */
export function repeatText(rrule: string): string {
  const parts = Object.fromEntries(rrule.split(";").map((p) => p.split("=")));
  const { FREQ: freq, BYDAY: byday, ...rest } = parts;
  const days: string[] = byday?.split(",") ?? [];
  const unit = { DAILY: "day", WEEKLY: "week", MONTHLY: "month" }[freq as string];
  if (!unit || Object.keys(rest).length || (byday && (freq !== "WEEKLY" || days.some((d) => !DAY_NAMES[d])))) return "This Meeting repeats.";
  if (days.join() === "MO,TU,WE,TH,FR") return "Repeats every weekday.";
  return `Repeats every ${unit}${days.length ? ` on ${days.map((d) => DAY_NAMES[d]).join(", ")}` : ""}.`;
}

/** The occurrences that touch [fromUtc, toUtc) (epoch seconds). The wall-clock start stays the same across a DST change. */
export function expandMeetings(all: MeetingSeries[], exceptions: MeetingException[], fromUtc: number, toUtc: number): MeetingOccurrence[] {
  const out: MeetingOccurrence[] = [];
  for (const s of all) {
    const changed = new Map(exceptions.filter((x) => x.seriesId === s.id).map((x) => [x.originalStartLocal, x]));
    const dtstart = Temporal.ZonedDateTime.from(`${s.startLocal}:00[${s.tz}]`);
    const length = s.durationMinutes * 60;
    // Look back one duration, so an occurrence that began before the range but runs into it is found.
    // Look further when the series has an exception, as an override can move an occurrence into the range.
    const slack = changed.size ? OVERRIDE_REACH : length;
    const starts = s.rrule
      ? new RRuleTemporal({ rruleString: s.rrule, dtstart }).between(new Date((fromUtc - slack) * 1000), new Date((toUtc + slack) * 1000), true)
      : [dtstart];
    for (const z of starts) {
      const original = z.toPlainDateTime().toString({ smallestUnit: "minute" });
      const x = changed.get(original);
      if (x?.kind === "skip") continue;
      const startUtc = x?.startLocal ? Temporal.ZonedDateTime.from(`${x.startLocal}:00[${s.tz}]`).epochMilliseconds / 1000 : z.epochMilliseconds / 1000;
      const endUtc = startUtc + (x?.durationMinutes ?? s.durationMinutes) * 60;
      if (startUtc < toUtc && endUtc > fromUtc) out.push({ seriesId: s.id, categoryId: x?.categoryId ?? s.categoryId, title: x?.title ?? s.title, tz: s.tz, startUtc, endUtc, originalStartLocal: original });
    }
  }
  return out.sort((a, b) => a.startUtc - b.startUtc);
}
