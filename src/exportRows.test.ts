import { expect, test } from "vitest";
import { exportDays, exportRows } from "./exportRows";

test("an Entry becomes a row in its own zone", () => {
  const start = Date.UTC(2026, 9, 26, 7, 30) / 1000; // 08:30 in Berlin (CET, DST ended on 25 October)
  const rows = exportRows([{ startUtc: start, endUtc: start + 5400, categoryId: 1, description: "x", tz: "Europe/Berlin" }], [], [], "Europe/Berlin", () => "A");
  expect(rows).toEqual([{ date: "2026-10-26", start: "08:30", end: "10:00", minutes: 90, category: "A", description: "x", absence: false }]);
});

test("Meetings and Absences become rows next to the Entries", () => {
  const start = Date.UTC(2026, 9, 26, 8, 0) / 1000; // 09:00 in Berlin
  const meeting = { seriesId: 1, categoryId: 2, title: "Sync", startUtc: start, endUtc: start + 1800, originalStartLocal: "2026-10-26T09:00" };
  const part = { id: 1, label: "Doctor", startDate: null, endDate: null, startUtc: start, endUtc: start + 3600, tz: "Europe/Berlin" };
  const full = { id: 2, label: "Vacation", startDate: "2026-10-27", endDate: "2026-10-28", startUtc: null, endUtc: null, tz: null };
  const rows = exportRows([], [meeting], [part, full], "Europe/Berlin", (id) => `C${id}`);
  expect(rows).toEqual([
    { date: "2026-10-26", start: "09:00", end: "09:30", minutes: 30, category: "C2", description: "Sync", absence: false },
    { date: "2026-10-26", start: "09:00", end: "10:00", minutes: 60, category: "Absence", description: "Doctor", absence: true },
    { date: "2026-10-27", start: "", end: "", minutes: 2880, category: "Absence", description: "Vacation", absence: true },
  ]);
});

test("locations get readable names", () => {
  expect(exportDays([{ date: "2026-10-26", location: "home" }])).toEqual([{ date: "2026-10-26", location: "Home" }]);
});
