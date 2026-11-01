import { dayBoundsIn, parseHM, Span, Ymd, weekday, ymdIn } from "./schedule";

/** The days in [fromUtc, toUtc), as days in `tz`. */
export function daysIn(tz: string, fromUtc: number, toUtc: number): Ymd[] {
  const first = ymdIn(tz, fromUtc);
  const out: Ymd[] = [];
  for (let n = 0; ; n++) {
    const t = new Date(Date.UTC(first.y, first.m - 1, first.d + n));
    const day = { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
    if (dayBoundsIn(tz, day)[0] >= toUtc) return out;
    out.push(day);
  }
}

/** The weekdays (0 is Sunday) to hide: a day that is no Workday and holds no item. FullCalendar's `hiddenDays` takes them. */
export function hiddenDays(tz: string, days: Ymd[], isWorkdayOn: (day: Ymd) => boolean, items: Span[]): number[] {
  const hidden = days.filter((day) => {
    const [from, to] = dayBoundsIn(tz, day);
    return !isWorkdayOn(day) && !items.some((x) => x.startUtc < to && x.endUtc > from);
  });
  return hidden.map(weekday);
}

/** Minutes after midnight of an instant on the wall clock of `tz`. */
function localMinutes(tz: string, sec: number): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", hour: "numeric", minute: "numeric" }).formatToParts(sec * 1000).map((x) => [x.type, Number(x.value)]));
  return p.hour * 60 + p.minute;
}

/**
 * The hours the week grid shows: work start minus one hour to work end plus one hour, widened in full hours to hold every timed item.
 * `minHour` is the first hour shown, `maxHour` the end of the last one (24 at most).
 */
export function gridRange(workStart: string, workEnd: string, tz: string, timed: Span[]): { minHour: number; maxHour: number } {
  let min = parseHM(workStart) - 60;
  let max = parseHM(workEnd) + 60;
  for (const item of timed) {
    const end = localMinutes(tz, item.endUtc);
    const endsOnStartDay = end !== 0 && ymdIn(tz, item.startUtc).d === ymdIn(tz, item.endUtc).d; // an end at 00:00 or on a later day is the end of the grid
    min = Math.min(min, localMinutes(tz, item.startUtc));
    max = Math.max(max, endsOnStartDay ? end : 1440);
  }
  return { minHour: Math.max(0, Math.floor(min / 60)), maxHour: Math.min(24, Math.ceil(max / 60)) };
}

/** What an Entry block shows: the title always, and a second line with the code and time from 45 minutes. `compact` is for 15 minutes or less. */
export function entryText(minutes: number, title: string, meta: string): { compact: boolean; title: string; meta: string | null } {
  return { compact: minutes <= 15, title, meta: minutes >= 45 ? meta : null };
}

/** A past Workday with less logged than expected. `gap` is its first unlogged time in work hours. `key` is the date key. */
export type DayTotal = { key: string; logged: number; expected: number; gap: Span | null };

/**
 * The day the short-day notice is about: the latest past day in `days` (ascending) that has less logged than expected.
 * Today and later never count. `dismissed` maps a date key to the logged minutes when the user dismissed it, so the notice stays away until more is logged.
 */
export function shortDay(days: DayTotal[], todayKey: string, dismissed: Record<string, number>): DayTotal | null {
  const day = days.filter((d) => d.key < todayKey && d.logged < d.expected).at(-1);
  return day && !(day.key in dismissed && day.logged <= dismissed[day.key]) ? day : null;
}

/** Minutes per Category over `entries`, largest first. */
export function weekShares(entries: (Span & { categoryId: number })[]): { categoryId: number; minutes: number }[] {
  const sums = new Map<number, number>();
  for (const e of entries) sums.set(e.categoryId, (sums.get(e.categoryId) ?? 0) + (e.endUtc - e.startUtc) / 60);
  return [...sums].map(([categoryId, minutes]) => ({ categoryId, minutes })).sort((a, b) => b.minutes - a.minutes);
}
