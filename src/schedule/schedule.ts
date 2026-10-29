/** Length of a span in whole minutes. */
export function minutesBetween(startUtc: number, endUtc: number): number {
  return Math.round((endUtc - startUtc) / 60);
}

export type Span = { startUtc: number; endUtc: number };

/** "HH:MM" as minutes after midnight. */
export function parseHM(t: string): number {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

/** Expected work in a day: work hours minus lunch. Both are "HH:MM" strings. */
export function expectedMinutes(s: { workStart: string; workEnd: string; lunchStart: string; lunchEnd: string }): number {
  return parseHM(s.workEnd) - parseHM(s.workStart) - (parseHM(s.lunchEnd) - parseHM(s.lunchStart));
}

/** A calendar day in a zone, as the numbers a person reads: month is 1 to 12. */
export type Ymd = { y: number; m: number; d: number };

/** Year, month and day of an instant (epoch seconds) in the IANA zone `tz`. */
export function ymdIn(tz: string, instantSec: number): Ymd {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(instantSec * 1000)
      .map((x) => [x.type, Number(x.value)]),
  );
  return { y: p.year, m: p.month, d: p.day };
}

/** The instant (epoch seconds) at which the wall clock in `tz` reads the given time. `d` may overflow into the next month. */
export function instantAt(tz: string, { y, m, d }: Ymd, minutes = 0): number {
  const wall = Date.UTC(y, m - 1, d, 0, minutes) / 1000;
  const offsetAt = (t: number) => {
    const w = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
        .formatToParts(t * 1000)
        .map((x) => [x.type, Number(x.value)]),
    );
    return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute) / 1000 - t;
  };
  // The offset at the guess may differ from the offset at the answer around a DST change, so correct once.
  const guess = wall - offsetAt(wall);
  return wall - offsetAt(guess);
}

/** Start and end (epoch seconds) of the day `ymd` in `tz`. A DST day is not 24 hours long. */
export function dayBoundsIn(tz: string, ymd: Ymd): [number, number] {
  return [instantAt(tz, ymd), instantAt(tz, { ...ymd, d: ymd.d + 1 })];
}

/** 0 is Sunday. */
export function weekday({ y, m, d }: Ymd): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Minutes of `entries` that fall inside the day [dayStartUtc, dayEndUtc). */
export function loggedMinutes(entries: Span[], dayStartUtc: number, dayEndUtc: number): number {
  const seconds = entries.reduce(
    (sum, e) => sum + Math.max(0, Math.min(e.endUtc, dayEndUtc) - Math.max(e.startUtc, dayStartUtc)),
    0,
  );
  return Math.round(seconds / 60);
}

/** "6h 30m", "8h", "45m". */
export function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}h`, (m || !h) && `${m}m`].filter(Boolean).join(" ");
}

/** Where `N` puts an Entry when nothing is selected: right after the last Entry of the day, or at `fallbackUtc`. */
export function nextFreeStart(entries: Span[], dayStartUtc: number, dayEndUtc: number, fallbackUtc: number): number {
  const ends = entries.filter((e) => e.startUtc >= dayStartUtc && e.startUtc < dayEndUtc).map((e) => e.endUtc);
  return ends.length ? Math.max(...ends) : fallbackUtc;
}
