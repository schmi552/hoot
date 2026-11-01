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

/** A day as "YYYY-MM-DD", the key of a Workday location. */
export const dateKey = ({ y, m, d }: Ymd) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

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

export const STEP = 15 * 60;

/** True if `span` overlaps an Entry other than `ignoreId`. Spans that only touch do not overlap. */
export function overlapsAny(entries: (Span & { id: number })[], span: Span, ignoreId = 0): boolean {
  return entries.some((e) => e.id !== ignoreId && e.startUtc < span.endUtc && e.endUtc > span.startUtc);
}

/** The end a resize can reach: at least one step long, and not past the next Entry. */
export function resizedEnd(entries: (Span & { id: number })[], id: number, wantedEnd: number): number {
  const self = entries.find((e) => e.id === id)!;
  const next = Math.min(...entries.filter((e) => e.id !== id && e.startUtc >= self.endUtc).map((e) => e.startUtc));
  return Math.min(Math.max(wantedEnd, self.startUtc + STEP), next);
}

/** The first slot of the same length at or after the end of `span` that overlaps no Entry. */
export function nextFreeSlot(entries: (Span & { id: number })[], span: Span): Span {
  const len = span.endUtc - span.startUtc;
  let startUtc = span.endUtc;
  for (const e of [...entries].sort((a, b) => a.startUtc - b.startUtc)) {
    if (e.startUtc < startUtc + len && e.endUtc > startUtc) startUtc = e.endUtc;
  }
  return { startUtc, endUtc: startUtc + len };
}

/** `workdays` holds the weekday digits of the Workdays, 0 is Sunday: "12345" is Monday to Friday. */
type WorkHours = { workStart: string; workEnd: string; lunchStart: string; lunchEnd: string; tz: string; intervalMinutes: number; workdays: string };

/** True if `ymd` is a Workday in `workdays`. */
export const isWorkday = (workdays: string, ymd: Ymd) => workdays.includes(String(weekday(ymd)));

/** A row of the settings history: the settings from the day `effectiveFrom` ("YYYY-MM-DD") on. */
export type SettingsRow<S> = S & { effectiveFrom: string };

/** The settings that are valid on `day`: the latest row that starts on or before it. A day before the first row uses the first row. */
export function settingsOn<S>(history: SettingsRow<S>[], day: Ymd): SettingsRow<S> {
  const key = dateKey(day);
  return [...history].reverse().find((r) => r.effectiveFrom <= key) ?? history[0];
}

/** The parts of `spans` that `cuts` do not cover. */
export function subtractSpans(spans: Span[], cuts: Span[]): Span[] {
  return cuts.reduce(
    (rest, c) => rest.flatMap((p) => [{ startUtc: p.startUtc, endUtc: Math.min(p.endUtc, c.startUtc) }, { startUtc: Math.max(p.startUtc, c.endUtc), endUtc: p.endUtc }].filter((x) => x.endUtc > x.startUtc)),
    spans,
  );
}

/** The parts of [fromUtc, toUtc] that are work time on the day of `toUtc`: inside work hours, lunch and `busy` spans (Meetings) cut out, whole minutes. Empty on a day that is not a Workday. */
export function popupSpans(s: WorkHours, fromUtc: number, toUtc: number, busy: Span[] = []): Span[] {
  const day = ymdIn(s.tz, toUtc);
  if (!isWorkday(s.workdays, day)) return [];
  const at = (hm: string) => instantAt(s.tz, day, parseHM(hm));
  const end = toUtc - (toUtc % 60);
  const work = [[s.workStart, s.lunchStart], [s.lunchEnd, s.workEnd]]
    .map(([a, b]) => ({ startUtc: Math.max(at(a), fromUtc), endUtc: Math.min(at(b), end) }))
    .filter((p) => p.endUtc > p.startUtc);
  return subtractSpans(work, busy);
}

/** Expected work on the day `ymd`: work time without lunch and without `absences`. Zero on a day that is not a Workday. */
export function expectedOn(s: WorkHours, ymd: Ymd, absences: Span[] = []): number {
  const [from, to] = dayBoundsIn(s.tz, ymd);
  return popupSpans(s, from, to - 1, absences).reduce((sum, p) => sum + minutesBetween(p.startUtc, p.endUtc), 0);
}

const lastEndBefore = (entries: Span[], nowUtc: number) => Math.max(0, ...entries.filter((e) => e.endUtc <= nowUtc).map((e) => e.endUtc));

/** A Gap must be longer than the popup interval by more than this, so a late tick is not a Gap. */
export const GAP_MARGIN_MINUTES = 5;

/**
 * The Gap at `nowUtc`, or null. It starts at the later of the last Entry end and the last answered or skipped popup,
 * has lunch and time outside work hours cut out, and shows only while work goes on and only for the current workday.
 */
export function gapDue(s: WorkHours, nowUtc: number, entries: Span[], lastPromptUtc: number, meetings: Span[] = []): Span[] | null {
  if (!popupDue(s, nowUtc, entries, lastPromptUtc, meetings)) return null;
  const spans = popupSpans(s, Math.max(lastEndBefore(entries, nowUtc), lastPromptUtc), nowUtc, meetings);
  const seconds = spans.reduce((sum, p) => sum + p.endUtc - p.startUtc, 0);
  return seconds > (s.intervalMinutes + GAP_MARGIN_MINUTES) * 60 ? spans : null;
}

/** Cuts the work time `spans` of a Gap at the instants `cutsUtc` (ascending) into one list of spans per part. A part inside lunch is empty. */
export function splitGap(spans: Span[], cutsUtc: number[]): Span[][] {
  const edges = [-Infinity, ...cutsUtc, Infinity];
  return edges.slice(1).map((end, i) =>
    spans.map((p) => ({ startUtc: Math.max(p.startUtc, edges[i]), endUtc: Math.min(p.endUtc, end) })).filter((p) => p.endUtc > p.startUtc),
  );
}

/**
 * The time a popup at `nowUtc` asks about, or null if no popup is due. A popup is due when a full interval has passed since
 * the last Entry ended, the last popup was answered or skipped (`lastPromptUtc`), or work began today, whichever is latest.
 */
export function popupDue(s: WorkHours, nowUtc: number, entries: Span[], lastPromptUtc: number, meetings: Span[] = []): Span[] | null {
  if (meetings.some((m) => m.startUtc <= nowUtc && m.endUtc > nowUtc)) return null; // no popup during a Meeting
  if (entries.some((e) => e.startUtc <= nowUtc && e.endUtc > nowUtc)) return null; // an Entry already covers now
  const lastEnd = lastEndBefore(entries, nowUtc);
  const workStart = instantAt(s.tz, ymdIn(s.tz, nowUtc), parseHM(s.workStart));
  if (nowUtc - Math.max(lastEnd, lastPromptUtc, workStart) < s.intervalMinutes * 60) return null;
  const spans = popupSpans(s, lastEnd, nowUtc, meetings);
  // Ask only while work is going on: the cut-out spans may still hold unlogged time, but not at lunch or after work.
  const inside = (a: string, b: string) => nowUtc >= instantAt(s.tz, ymdIn(s.tz, nowUtc), parseHM(a)) && nowUtc < instantAt(s.tz, ymdIn(s.tz, nowUtc), parseHM(b));
  const working = inside(s.workStart, s.workEnd) && !inside(s.lunchStart, s.lunchEnd);
  return working && spans.length ? spans : null;
}

/** The last `n` different Entries (description plus Category), newest first. */
export function recentEntries<T extends Span & { categoryId: number; description: string }>(entries: T[], n = 3): T[] {
  const seen = new Set<string>();
  return [...entries]
    .sort((a, b) => b.startUtc - a.startUtc)
    .filter((e) => !seen.has(`${e.categoryId}|${e.description}`) && seen.add(`${e.categoryId}|${e.description}`))
    .slice(0, n);
}

/**
 * The next minute a popup is due, or null if none is due in the next 8 days.
 * It ignores Entries that end after `nowUtc`.
 * It cannot know when the user last answered or skipped a popup: only the popup window knows that.
 */
export function nextCheckIn(s: WorkHours, nowUtc: number, entries: Span[] = [], busy: Span[] = []): number | null {
  const first = Math.floor(nowUtc / 60) * 60 + 60;
  const past = entries.filter((e) => e.endUtc <= nowUtc);
  for (let n = 0; n < 8; n++) {
    const day = ymdIn(s.tz, first + n * 86_400);
    if (!isWorkday(s.workdays, day)) continue;
    const [from, to] = dayBoundsIn(s.tz, day);
    for (let t = Math.max(first, from); t < to; t += 60) if (popupDue(s, t, past, 0, busy)) return t;
  }
  return null;
}
