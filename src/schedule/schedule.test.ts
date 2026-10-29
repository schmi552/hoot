import { expect, test } from "vitest";
import { dayBoundsIn, expectedMinutes, instantAt, weekday, ymdIn, formatHM, loggedMinutes, minutesBetween, nextFreeStart, nextFreeSlot, overlapsAny, resizedEnd } from "./schedule";

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
