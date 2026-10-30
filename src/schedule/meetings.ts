import { RRuleTemporal } from "rrule-temporal";
import { Temporal } from "temporal-polyfill";
import type { Span } from "./schedule";

/** A Meeting or a recurring Meeting. `startLocal` is "YYYY-MM-DDTHH:MM" on the wall clock of `tz`; `rrule` is null for a one-off. */
export type MeetingSeries = { id: number; categoryId: number; title: string; startLocal: string; durationMinutes: number; tz: string; rrule: string | null };
export type MeetingOccurrence = Span & { seriesId: number; categoryId: number; title: string };

export type Repeat = "none" | "daily" | "weekdays" | "weekly" | "monthly";
export const REPEATS: Repeat[] = ["none", "daily", "weekdays", "weekly", "monthly"];

/** The RRULE of a Repeat choice, or null for "none". */
export function ruleFor(repeat: Repeat): string | null {
  return { none: null, daily: "FREQ=DAILY", weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", weekly: "FREQ=WEEKLY", monthly: "FREQ=MONTHLY" }[repeat];
}

/** The occurrences that touch [fromUtc, toUtc) (epoch seconds). The wall-clock start stays the same across a DST change. */
export function expandMeetings(all: MeetingSeries[], fromUtc: number, toUtc: number): MeetingOccurrence[] {
  const out: MeetingOccurrence[] = [];
  for (const s of all) {
    const dtstart = Temporal.ZonedDateTime.from(`${s.startLocal}:00[${s.tz}]`);
    const length = s.durationMinutes * 60;
    // Look back one duration, so an occurrence that began before the range but runs into it is found.
    const starts = s.rrule
      ? new RRuleTemporal({ rruleString: s.rrule, dtstart }).between(new Date((fromUtc - length) * 1000), new Date(toUtc * 1000), true).map((z) => z.epochMilliseconds / 1000)
      : [dtstart.epochMilliseconds / 1000];
    for (const startUtc of starts) {
      if (startUtc < toUtc && startUtc + length > fromUtc) out.push({ seriesId: s.id, categoryId: s.categoryId, title: s.title, startUtc, endUtc: startUtc + length });
    }
  }
  return out.sort((a, b) => a.startUtc - b.startUtc);
}
