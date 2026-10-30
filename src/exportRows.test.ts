import { expect, test } from "vitest";
import { exportDays, exportRows } from "./exportRows";

const RANGE = { from: "2026-10-26", to: "2026-10-28" };

test("an Entry becomes a row in its own zone", () => {
  const start = Date.UTC(2026, 9, 26, 7, 30) / 1000; // 08:30 in Berlin (CET, DST ended on 25 October)
  const rows = exportRows([{ startUtc: start, endUtc: start + 5400, categoryId: 1, description: "x", tz: "Europe/Berlin" }], [], [], "Europe/Berlin", RANGE, () => "A");
  expect(rows).toEqual([{ date: "2026-10-26", start: "08:30", end: "10:00", minutes: 90, category: "A", description: "x", absence: false }]);
});

test("rows are in time order and a Meeting keeps its own zone", () => {
  const start = Date.UTC(2026, 9, 26, 8, 0) / 1000;
  const entry = { startUtc: start + 7200, endUtc: start + 9000, categoryId: 1, description: "late", tz: "Europe/Berlin" };
  const meeting = { seriesId: 1, categoryId: 1, title: "Sync", tz: "America/New_York", startUtc: start, endUtc: start + 1800, originalStartLocal: "2026-10-26T04:00" };
  const rows = exportRows([entry], [meeting], [], "Europe/Berlin", RANGE, () => "A");
  expect(rows.map((r) => [r.description, r.start])).toEqual([["Sync", "04:00"], ["late", "11:00"]]);
});

test("Meetings and Absences become rows next to the Entries", () => {
  const start = Date.UTC(2026, 9, 26, 8, 0) / 1000; // 09:00 in Berlin
  const meeting = { seriesId: 1, categoryId: 2, title: "Sync", tz: "Europe/Berlin", startUtc: start, endUtc: start + 1800, originalStartLocal: "2026-10-26T09:00" };
  const part = { id: 1, label: "Doctor", startDate: null, endDate: null, startUtc: start, endUtc: start + 3600, tz: "Europe/Berlin" };
  const full = { id: 2, label: "Vacation", startDate: "2026-10-27", endDate: "2026-10-29", startUtc: null, endUtc: null, tz: null };
  const rows = exportRows([], [meeting], [part, full], "Europe/Berlin", RANGE, (id) => `C${id}`);
  const A = "Absence (not worked)";
  expect(rows).toEqual([
    { date: "2026-10-26", start: "09:00", end: "09:30", minutes: 30, category: "C2", description: "Sync", absence: false },
    { date: "2026-10-26", start: "09:00", end: "10:00", minutes: 60, category: A, description: "Doctor", absence: true },
    // one row per day inside the timeframe; 29 October is cut off
    { date: "2026-10-27", start: "", end: "", minutes: 0, category: A, description: "Vacation", absence: true },
    { date: "2026-10-28", start: "", end: "", minutes: 0, category: A, description: "Vacation", absence: true },
  ]);
});

test("locations get readable names", () => {
  expect(exportDays([{ date: "2026-10-26", location: "home" }])).toEqual([{ date: "2026-10-26", location: "Home" }]);
});
