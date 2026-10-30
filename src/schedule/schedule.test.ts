import { expect, test } from "vitest";
import { dayBoundsIn, expectedMinutes, instantAt, weekday, ymdIn, formatHM, loggedMinutes, minutesBetween, nextFreeStart, nextFreeSlot, overlapsAny, gapDue, popupDue, popupSpans, splitGap, recentEntries, resizedEnd } from "./schedule";

test("minutesBetween counts minutes between two epoch-second instants", () => {
  expect(minutesBetween(1_000, 1_000 + 90 * 60)).toBe(90);
});

test("expected time is work hours minus lunch", () => {
  expect(expectedMinutes({ workStart: "09:00", workEnd: "17:00", lunchStart: "12:00", lunchEnd: "13:00" })).toBe(7 * 60);
});

test("logged time adds the Entries of the day and cuts those that cross midnight", () => {
  const entries = [
    { startUtc: 86_400 - 1800, endUtc: 86_400 + 1800 }, // 30 min before the day, 30 min in it
    { startUtc: 86_400 + 3600, endUtc: 86_400 + 3600 + 5400 },
  ];
  expect(loggedMinutes(entries, 86_400, 2 * 86_400)).toBe(30 + 90);
});

test("durations read as in the day header", () => {
  expect([formatHM(390), formatHM(480), formatHM(45), formatHM(0)]).toEqual(["6h 30m", "8h", "45m", "0m"]);
});

test("N starts after the last Entry of the day, or at the fallback on an empty day", () => {
  const entries = [
    { startUtc: 100, endUtc: 200 },
    { startUtc: 300, endUtc: 400 },
    { startUtc: 5_000, endUtc: 6_000 }, // another day
  ];
  expect(nextFreeStart(entries, 0, 1_000, 50)).toBe(400);
  expect(nextFreeStart([], 0, 1_000, 50)).toBe(50);
});

test("a day is bounded by midnight in its own zone, also on a DST day", () => {
  const hours = ([a, b]: [number, number]) => (b - a) / 3600;
  expect(hours(dayBoundsIn("Europe/Berlin", { y: 2026, m: 3, d: 28 }))).toBe(24);
  expect(hours(dayBoundsIn("Europe/Berlin", { y: 2026, m: 3, d: 29 }))).toBe(23);
  expect(hours(dayBoundsIn("Europe/Berlin", { y: 2026, m: 10, d: 25 }))).toBe(25);
  // Midnight in Berlin (UTC+1 in January) is 23:00 UTC the evening before.
  expect(dayBoundsIn("Europe/Berlin", { y: 2026, m: 1, d: 10 })[0]).toBe(Date.UTC(2026, 0, 9, 23) / 1000);
});

test("a clock time in a zone becomes an instant, and the instant reads back as that day", () => {
  const t = instantAt("America/New_York", { y: 2026, m: 7, d: 4 }, 9 * 60); // 09:00 at UTC-4
  expect(t).toBe(Date.UTC(2026, 6, 4, 13) / 1000);
  expect(ymdIn("America/New_York", t)).toEqual({ y: 2026, m: 7, d: 4 });
  expect(ymdIn("Asia/Tokyo", t)).toEqual({ y: 2026, m: 7, d: 4 });
  expect(weekday({ y: 2026, m: 7, d: 4 })).toBe(6);
});

const e = (id: number, startUtc: number, endUtc: number) => ({ id, startUtc, endUtc });
const day = [e(1, 1000, 2000), e(2, 2000, 3000), e(3, 3600, 4000)];

test("a move or paste overlaps when it enters another Entry, but not when it only touches or hits itself", () => {
  expect(overlapsAny(day, { startUtc: 1500, endUtc: 2500 }, 1)).toBe(true);
  expect(overlapsAny(day, { startUtc: 3000, endUtc: 3600 })).toBe(false);
  expect(overlapsAny(day, { startUtc: 1100, endUtc: 1900 }, 1)).toBe(false);
  expect(overlapsAny(day, { startUtc: 1100, endUtc: 1900 })).toBe(true);
});

test("a resize stops at the next Entry and keeps one step of length", () => {
  expect(resizedEnd(day, 2, 3500)).toBe(3500);
  expect(resizedEnd(day, 2, 9000)).toBe(3600);
  expect(resizedEnd(day, 1, 9000)).toBe(2000);
  expect(resizedEnd(day, 3, 9000)).toBe(9000);
  expect(resizedEnd(day, 3, 3000)).toBe(3600 + 900);
});

test("a duplicate goes into the next free slot after the original", () => {
  expect(nextFreeSlot(day, { startUtc: 1000, endUtc: 2000 })).toEqual({ startUtc: 4000, endUtc: 5000 });
  expect(nextFreeSlot(day, { startUtc: 3600, endUtc: 4000 })).toEqual({ startUtc: 4000, endUtc: 4400 });
});

const hours = { workStart: "09:00", workEnd: "17:00", lunchStart: "12:00", lunchEnd: "13:00", tz: "UTC", intervalMinutes: 60 };
const friday = { y: 2026, m: 10, d: 30 };
const at = (h: number, m = 0, ymd = friday) => instantAt("UTC", ymd, h * 60 + m);
const span = (a: number, b: number, bm = 0) => ({ startUtc: at(a), endUtc: at(b, bm) });

test("the popup span runs from the end of the last Entry to now", () => {
  expect(popupSpans(hours, at(10), at(11, 30))).toEqual([span(10, 11, 30)]);
});

test("the popup span starts at the start of work hours if the last Entry ended earlier", () => {
  expect(popupSpans(hours, at(7), at(10))).toEqual([span(9, 10)]);
});

test("the popup span cuts out lunch", () => {
  expect(popupSpans(hours, at(11), at(14))).toEqual([span(11, 12), span(13, 14)]);
});

test("the popup span ends at the end of work hours and keeps minute precision", () => {
  expect(popupSpans(hours, at(16), at(18))).toEqual([span(16, 17)]);
  expect(popupSpans(hours, at(10, 7), at(10, 41) + 30)).toEqual([{ startUtc: at(10, 7), endUtc: at(10, 41) }]);
});

test("there is no popup span on a weekend", () => {
  const saturday = { y: 2026, m: 10, d: 31 };
  expect(popupSpans(hours, at(9, 0, saturday), at(11, 0, saturday))).toEqual([]);
});

test("a popup is due when a full interval has passed since the last Entry", () => {
  const entries = [span(9, 10)];
  expect(popupDue(hours, at(10, 59), entries, 0)).toBeNull();
  expect(popupDue(hours, at(11), entries, 0)).toEqual([span(10, 11)]);
});

test("a skipped or snoozed popup delays the next one", () => {
  expect(popupDue(hours, at(11), [span(9, 10)], at(10, 30))).toBeNull();
  expect(popupDue(hours, at(11, 30), [span(9, 10)], at(10, 30))).toEqual([span(10, 11, 30)]);
});

test("the first popup of the day comes one interval after work starts", () => {
  expect(popupDue(hours, at(9, 59), [], 0)).toBeNull();
  expect(popupDue(hours, at(10), [], 0)).toEqual([span(9, 10)]);
});

test("no popup during lunch or outside work hours", () => {
  expect(popupDue(hours, at(12, 30), [span(9, 11)], 0)).toBeNull();
  expect(popupDue(hours, at(13), [span(9, 11)], 0)).toEqual([span(11, 12)]);
  expect(popupDue(hours, at(18), [span(9, 16)], 0)).toBeNull();
  expect(popupDue(hours, at(8), [], 0)).toBeNull();
});

test("recent Entries are the last three different ones, newest first", () => {
  const e = (startUtc: number, categoryId: number, description: string) => ({ startUtc, endUtc: startUtc + 1, categoryId, description });
  const list = [e(1, 1, "a"), e(2, 2, "b"), e(3, 1, "a"), e(4, 1, "c"), e(5, 3, "d")];
  expect(recentEntries(list).map((x) => x.startUtc)).toEqual([5, 4, 3]);
});

test("no popup while an Entry covers the present", () => {
  expect(popupDue(hours, at(11), [span(9, 10), span(10, 12)], 0)).toBeNull();
});

const gapSettings = { workStart: "09:00", workEnd: "17:00", lunchStart: "12:00", lunchEnd: "13:00", tz: "UTC", intervalMinutes: 30 };
const t = (h: number, m = 0) => Date.UTC(2026, 9, 28, h, m) / 1000; // Wednesday

test("a Gap starts at the later of the last Entry end and the last popup, and lunch is cut out", () => {
  const entries = [{ startUtc: t(9), endUtc: t(10) }];
  expect(gapDue(gapSettings, t(11), entries, 0)).toEqual([{ startUtc: t(10), endUtc: t(11) }]);
  expect(gapDue(gapSettings, t(11), entries, t(10, 15))).toEqual([{ startUtc: t(10, 15), endUtc: t(11) }]);
  expect(gapDue(gapSettings, t(14), entries, 0)).toEqual([{ startUtc: t(10), endUtc: t(12) }, { startUtc: t(13), endUtc: t(14) }]);
});

test("no Gap when it is not longer than the interval plus the margin, or when no work goes on", () => {
  const entries = [{ startUtc: t(9), endUtc: t(10) }];
  expect(gapDue(gapSettings, t(10, 35), entries, 0)).toBeNull();
  expect(gapDue(gapSettings, t(10, 36), entries, 0)).not.toBeNull();
  expect(gapDue(gapSettings, t(12, 30), entries, 0)).toBeNull(); // lunch
  expect(gapDue(gapSettings, t(18), entries, 0)).toBeNull(); // after work
});

test("only the current workday makes a Gap", () => {
  const friday = [{ startUtc: Date.UTC(2026, 9, 23, 9) / 1000, endUtc: Date.UTC(2026, 9, 23, 10) / 1000 }];
  expect(gapDue(gapSettings, t(11), friday, 0)).toEqual([{ startUtc: t(9), endUtc: t(11) }]);
});

test("a Gap splits at the given times and lunch stays out of the parts", () => {
  const spans = [{ startUtc: t(10), endUtc: t(12) }, { startUtc: t(13), endUtc: t(14) }];
  expect(splitGap(spans, [t(11), t(13, 30)])).toEqual([
    [{ startUtc: t(10), endUtc: t(11) }],
    [{ startUtc: t(11), endUtc: t(12) }, { startUtc: t(13), endUtc: t(13, 30) }],
    [{ startUtc: t(13, 30), endUtc: t(14) }],
  ]);
  expect(splitGap(spans, [t(12, 30)])[1]).toEqual([{ startUtc: t(13), endUtc: t(14) }]);
});
