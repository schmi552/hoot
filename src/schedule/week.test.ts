import { expect, test } from "vitest";
import { instantAt, isWorkday } from "./schedule";
import { daysIn, entryText, gridRange, hiddenDays } from "./week";

const tz = "Europe/Zurich";
const at = (d: number, h: number, m = 0) => instantAt(tz, { y: 2026, m: 10, d }, h * 60 + m);
const week = daysIn(tz, at(26, 0), at(33, 0)); // Mon 26 Oct to Sun 1 Nov
const monToFri = (day: Parameters<typeof isWorkday>[1]) => isWorkday("12345", day);

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

test("an item inside the range does not change it", () => {
  expect(gridRange("08:00", "17:00", tz, [{ startUtc: at(27, 9), endUtc: at(27, 10) }])).toEqual({ minHour: 7, maxHour: 18 });
});

test("an Entry shows one line at 15 minutes, the title at 30, and title plus code and time from 45", () => {
  expect(entryText(15, "Fix", "PSP-1 · 09:00–09:15")).toEqual({ compact: true, title: "Fix", meta: null });
  expect(entryText(30, "Fix", "PSP-1 · 09:00–09:30")).toEqual({ compact: false, title: "Fix", meta: null });
  expect(entryText(45, "Fix", "PSP-1 · 09:00–09:45")).toEqual({ compact: false, title: "Fix", meta: "PSP-1 · 09:00–09:45" });
  expect(entryText(120, "Fix", "m").meta).toBe("m");
});
