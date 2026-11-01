import { expect, test } from "vitest";
import { instantAt, isWorkday, Ymd } from "./schedule";
import { barSegments, daysIn, entryText, gridRange, hiddenDays, rowTotals, shortDay, showsDayTotal, weekShares } from "./week";

const tz = "Europe/Zurich";
const at = (d: number, h: number, m = 0) => instantAt(tz, { y: 2026, m: 10, d }, h * 60 + m);
const week = daysIn(tz, at(26, 0), at(33, 0)); // Mon 26 Oct to Sun 1 Nov
const monToFri = (day: Ymd) => isWorkday("12345", day);

test("a week has seven days, also across the change to winter time", () => {
  expect(week).toHaveLength(7);
  expect(week[0]).toEqual({ y: 2026, m: 10, d: 26 });
  expect(week[6]).toEqual({ y: 2026, m: 11, d: 1 });
});

test("only the Workdays show", () => {
  expect(hiddenDays(tz, week, monToFri, [])).toEqual([6, 0]);
  expect(hiddenDays(tz, week, (d) => isWorkday("24", d), [])).toEqual([1, 3, 5, 6, 0]);
});

test("a non-workday with an Entry, Meeting or Absence shows", () => {
  const saturday = { startUtc: at(31, 10), endUtc: at(31, 11) };
  expect(hiddenDays(tz, week, monToFri, [saturday])).toEqual([0]);
  const overnight = { startUtc: at(31, 22), endUtc: at(32, 2) }; // Sat 22:00 to Sun 02:00
  expect(hiddenDays(tz, week, monToFri, [overnight])).toEqual([]);
});

test("the grid runs from work start minus one hour to work end plus one hour", () => {
  expect(gridRange("08:30", "17:30", tz, [])).toEqual({ minHour: 7, maxHour: 19 });
  expect(gridRange("08:00", "17:00", tz, [])).toEqual({ minHour: 7, maxHour: 18 });
});

test("the grid widens in full hours to show an item outside", () => {
  expect(gridRange("08:00", "17:00", tz, [{ startUtc: at(27, 5, 20), endUtc: at(27, 6) }]).minHour).toBe(5);
  expect(gridRange("08:00", "17:00", tz, [{ startUtc: at(27, 19), endUtc: at(27, 20, 15) }]).maxHour).toBe(21);
  expect(gridRange("08:00", "17:00", tz, [{ startUtc: at(27, 19), endUtc: at(27, 20) }]).maxHour).toBe(20);
  expect(gridRange("08:00", "17:00", tz, [{ startUtc: at(27, 22), endUtc: at(28, 1) }]).maxHour).toBe(24);
});

test("an item that ends at midnight widens the grid to 24", () => {
  expect(gridRange("08:00", "17:00", tz, [{ startUtc: at(27, 22), endUtc: at(28, 0) }]).maxHour).toBe(24);
});

test("an item inside the range does not change it", () => {
  expect(gridRange("08:00", "17:00", tz, [{ startUtc: at(27, 9), endUtc: at(27, 10) }])).toEqual({ minHour: 7, maxHour: 18 });
});

test("an Entry shows one line at 15 minutes, the title at 30, and title plus code and time from 45", () => {
  expect(entryText(15, "Fix", "PSP-1 · 09:00–09:15")).toEqual({ compact: true, title: "Fix", meta: null });
  expect(entryText(30, "Fix", "PSP-1 · 09:00–09:30")).toEqual({ compact: false, title: "Fix", meta: null });
  expect(entryText(45, "Fix", "PSP-1 · 09:00–09:45")).toEqual({ compact: false, title: "Fix", meta: "PSP-1 · 09:00–09:45" });
  expect(entryText(20, "Fix", "m").meta).toBeNull();
  expect(entryText(44, "Fix", "m").meta).toBeNull();
  expect(entryText(120, "Fix", "m").meta).toBe("m");
});

const row = (d: number, logged: number, expected: number, gap: { startUtc: number; endUtc: number } | null = null) => ({ key: `2026-10-${d}`, logged, expected, gap });
const thu = "2026-10-29";

test("the short-day notice is for the latest short past Workday", () => {
  const gap = { startUtc: at(27, 10), endUtc: at(27, 11) };
  const rows = [row(26, 400, 480, { startUtc: at(26, 9), endUtc: at(26, 10) }), row(27, 420, 480, gap), row(28, 480, 480)];
  expect(shortDay(rows, thu, {})).toEqual(rows[1]);
});

test("the short-day notice uses the first unlogged gap of the day as its range", () => {
  const gap = { startUtc: at(27, 10), endUtc: at(27, 11) };
  expect(shortDay([row(27, 420, 480, gap)], thu, {})?.gap).toEqual(gap);
});

test("today and the future never warn", () => {
  expect(shortDay([row(29, 0, 480), row(30, 0, 480)], thu, {})).toBeNull();
});

test("a day with no expected time never warns", () => {
  expect(shortDay([row(31, 0, 0)], "2026-11-02", {})).toBeNull();
});

test("a dismissed day stays quiet until the user logs more", () => {
  const rows = [row(27, 420, 480)];
  expect(shortDay(rows, thu, { "2026-10-27": 420 })).toBeNull();
  expect(shortDay([row(27, 450, 480)], thu, { "2026-10-27": 420 })).not.toBeNull();
});

test("a dismissed latest day hides the notice and does not fall back to an earlier day", () => {
  const rows = [row(26, 400, 480), row(27, 420, 480)];
  expect(shortDay(rows, thu, { "2026-10-27": 420 })).toBeNull();
});

test("the week shares count minutes per Category, largest first", () => {
  const e = (categoryId: number, from: number, to: number) => ({ categoryId, startUtc: at(26, from), endUtc: at(26, to) });
  expect(weekShares([e(1, 9, 10), e(2, 10, 13), e(1, 13, 14)])).toEqual([{ categoryId: 2, minutes: 180 }, { categoryId: 1, minutes: 120 }]);
  expect(weekShares([])).toEqual([]);
});

test("the week total counts all seven days and the expected time only the Workdays", () => {
  const row = [8 * 60, 8 * 60, 0, 8 * 60, 8 * 60, 90, 0].map((logged, i) => ({ logged, expected: i < 5 ? 8 * 60 : 0 })); // Wed is a day off with 0 expected; Sat has 90 minutes
  expect(rowTotals(row)).toEqual({ logged: 32 * 60 + 90, expected: 5 * 8 * 60 });
});

test("a weekend day shows a total and bar only when it has Entries", () => {
  expect(showsDayTotal({ logged: 0, expected: 0 }, false)).toBe(false);
  expect(showsDayTotal({ logged: 90, expected: 0 }, false)).toBe(true);
  expect(showsDayTotal({ logged: 0, expected: 480 }, false)).toBe(true); // a past or current Workday with nothing logged is a short day
  expect(showsDayTotal({ logged: 0, expected: 480 }, true)).toBe(false); // a future Workday is quiet
});

test("the bar splits the day by Category", () => {
  const e = (categoryId: number, from: number, to: number) => ({ categoryId, startUtc: at(26, from), endUtc: at(26, to) });
  expect(barSegments([e(1, 8, 9), e(2, 9, 12)])).toEqual([{ categoryId: 2, percent: 75 }, { categoryId: 1, percent: 25 }]);
});
