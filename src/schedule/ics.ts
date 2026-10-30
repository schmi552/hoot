import ICAL from "ical.js";
import { RRuleTemporal } from "rrule-temporal";
import { Temporal } from "temporal-polyfill";
import type { MeetingException } from "./meetings";

/** A Meeting from an `.ics` file, before the user gives it a Category. The exceptions have no series id yet. */
export type ImportedMeeting = {
  title: string; startLocal: string; durationMinutes: number; tz: string; rrule: string | null;
  exceptions: Omit<MeetingException, "seriesId">[];
};
export type IcsImport = { meetings: ImportedMeeting[]; warnings: string[] };

/** Windows zone names that calendar apps write as TZID, mapped to IANA names. */
const WINDOWS_ZONES: Record<string, string> = {
  "UTC": "UTC", "GMT Standard Time": "Europe/London", "W. Europe Standard Time": "Europe/Berlin", "Central Europe Standard Time": "Europe/Budapest",
  "Romance Standard Time": "Europe/Paris", "Central European Standard Time": "Europe/Warsaw", "E. Europe Standard Time": "Europe/Chisinau",
  "FLE Standard Time": "Europe/Kiev", "GTB Standard Time": "Europe/Bucharest", "Russian Standard Time": "Europe/Moscow", "Turkey Standard Time": "Europe/Istanbul",
  "Eastern Standard Time": "America/New_York", "Central Standard Time": "America/Chicago", "Mountain Standard Time": "America/Denver",
  "US Mountain Standard Time": "America/Phoenix", "Pacific Standard Time": "America/Los_Angeles", "Alaskan Standard Time": "America/Anchorage",
  "Atlantic Standard Time": "America/Halifax", "E. South America Standard Time": "America/Sao_Paulo", "India Standard Time": "Asia/Kolkata",
  "China Standard Time": "Asia/Shanghai", "Tokyo Standard Time": "Asia/Tokyo", "Korea Standard Time": "Asia/Seoul", "Singapore Standard Time": "Asia/Singapore",
  "AUS Eastern Standard Time": "Australia/Sydney", "New Zealand Standard Time": "Pacific/Auckland", "South Africa Standard Time": "Africa/Johannesburg",
  "Arab Standard Time": "Asia/Riyadh", "Arabian Standard Time": "Asia/Dubai", "Israel Standard Time": "Asia/Jerusalem",
};

const skip = (originalStartLocal: string): ImportedMeeting["exceptions"][number] => ({ originalStartLocal, kind: "skip", startLocal: null, durationMinutes: null, title: null, categoryId: null });

const isZone = (tz: string) => {
  try { Temporal.ZonedDateTime.from(`2026-01-01T00:00[${tz}]`); return true; } catch { return false; }
};

const toLocalMinute = (z: Temporal.ZonedDateTime) => z.toPlainDateTime().toString({ smallestUnit: "minute" });

/** Read a date-time property in its own zone. If the file has no VTIMEZONE for the TZID, ical.js still gives the wall-clock time, so this works. */
function readTime(prop: ICAL.Property, value: ICAL.Time, localTz: string, warnings: string[]): Temporal.ZonedDateTime {
  const tzid = prop.getParameter("tzid") as string | undefined;
  let tz = localTz; // a floating time is local time
  if (value.zone.tzid === "UTC") tz = "UTC";
  else if (tzid) {
    const mapped = WINDOWS_ZONES[tzid] ?? tzid;
    if (isZone(mapped)) tz = mapped;
    else {
      const warning = `Unknown time zone "${tzid}": its times are read as local time.`;
      if (!warnings.includes(warning)) warnings.push(warning);
    }
  }
  return Temporal.ZonedDateTime.from({ timeZone: tz, year: value.year, month: value.month, day: value.day, hour: value.hour, minute: value.minute });
}

/** Parse `.ics` text. Times keep the zone of the series, so a Meeting stays at the same wall-clock time across DST. All-day events are skipped. */
export function parseIcs(text: string, localTz: string): IcsImport {
  const warnings: string[] = [];
  const events = new ICAL.Component(ICAL.parse(text)).getAllSubcomponents("vevent");
  const uid = (e: ICAL.Component) => String(e.getFirstPropertyValue("uid") ?? "");
  const timed = (e: ICAL.Component) => !!e.getFirstPropertyValue("dtstart") && !(e.getFirstPropertyValue("dtstart") as ICAL.Time).isDate;
  const summary = (e: ICAL.Component) => String(e.getFirstPropertyValue("summary") || "(no title)");
  const cancelled = (e: ICAL.Component) => String(e.getFirstPropertyValue("status")).toUpperCase() === "CANCELLED";
  const span = (e: ICAL.Component) => {
    const start = readTime(e.getFirstProperty("dtstart")!, e.getFirstPropertyValue("dtstart") as ICAL.Time, localTz, warnings);
    const endProp = e.getFirstProperty("dtend");
    const end = endProp ? readTime(endProp, endProp.getFirstValue() as ICAL.Time, localTz, warnings) : start.add({ seconds: (e.getFirstPropertyValue("duration") as ICAL.Duration | null)?.toSeconds() ?? 0 });
    return { start, minutes: Math.round(Number(end.epochMilliseconds - start.epochMilliseconds) / 60_000) };
  };

  const skipped = events.filter((e) => !timed(e));
  if (skipped.length) warnings.push(`${skipped.length} all-day event${skipped.length > 1 ? "s were" : " was"} skipped.`);
  const usable = events.filter(timed);
  const masters = usable.filter((e) => !e.hasProperty("recurrence-id") && !cancelled(e));
  const out = new Map<string, ImportedMeeting>(); // by UID
  for (const e of masters) {
    const { start, minutes } = span(e);
    if (minutes < 1) { warnings.push(`"${summary(e)}" has no length and was skipped.`); continue; }
    let rrule = e.getFirstProperty("rrule")?.getFirstValue()?.toString() ?? null;
    if (rrule) {
      try { new RRuleTemporal({ rruleString: rrule, dtstart: start }); } catch { warnings.push(`"${summary(e)}" has a repeat rule that is not supported. It was imported as one Meeting.`); rrule = null; }
    }
    const skips = e.getAllProperties("exdate").flatMap((p) => p.getValues().map((v: ICAL.Time) =>
      v.isDate ? `${v.toString()}T${toLocalMinute(start).slice(11)}` : toLocalMinute(readTime(p, v, localTz, warnings).withTimeZone(start.timeZoneId))));
    out.set(uid(e), {
      title: summary(e), startLocal: toLocalMinute(start), durationMinutes: minutes, tz: start.timeZoneId, rrule,
      exceptions: skips.map(skip),
    });
  }
  for (const e of usable.filter((x) => x.hasProperty("recurrence-id"))) {
    const master = out.get(uid(e));
    const id = e.getFirstProperty("recurrence-id")!;
    const idTime = id.getFirstValue() as ICAL.Time;
    if (!master) {
      if (!cancelled(e)) { // the file holds only the changed occurrence: keep it as a one-off Meeting
        const { start, minutes } = span(e);
        if (minutes >= 1) out.set(`${uid(e)}#${toLocalMinute(start)}`, { title: summary(e), startLocal: toLocalMinute(start), durationMinutes: minutes, tz: start.timeZoneId, rrule: null, exceptions: [] });
      }
      continue;
    }
    const original = idTime.isDate ? `${idTime.toString()}T${master.startLocal.slice(11)}` : toLocalMinute(readTime(id, idTime, localTz, warnings).withTimeZone(master.tz));
    if (cancelled(e)) { master.exceptions.push(skip(original)); continue; }
    const { start, minutes } = span(e);
    master.exceptions.push({ originalStartLocal: original, kind: "override", startLocal: toLocalMinute(start.withTimeZone(master.tz)), durationMinutes: minutes, title: summary(e), categoryId: null });
  }
  for (const m of out.values()) m.exceptions = [...new Map(m.exceptions.map((x) => [x.originalStartLocal, x])).values()]; // an override beats an EXDATE on the same day
  return { meetings: [...out.values()], warnings };
}
