import { expect, test } from "vitest";
import { expectedMinutes, formatHM, loggedMinutes, minutesBetween, nextFreeStart } from "./schedule";

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
