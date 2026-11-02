import { expect, test } from "vitest";
import { exportDays, exportFileName, exportPresets, exportRows, formatDmy, parseDmy } from "./exportRows";

const RANGE = { from: "2026-10-26", to: "2026-10-28" };

test("an Entry becomes a row in its own zone", () => {
  const start = Date.UTC(2026, 9, 26, 7, 30) / 1000; // 08:30 in Berlin (CET, DST ended on 25 October)
  const rows = exportRows([{ startUtc: start, endUtc: start + 5400, categoryId: 1, description: "x", tz: "Europe/Berlin" }], [], [], "Europe/Berlin", RANGE, () => ({ code: "P-1", name: "A" }));
  expect(rows).toEqual([{ date: "2026-10-26", start: "08:30", end: "10:00", minutes: 90, code: "P-1", category: "A", description: "x", absence: false }]);
});

test("rows are in time order and a Meeting keeps its own zone", () => {
  const start = Date.UTC(2026, 9, 26, 8, 0) / 1000;
  const entry = { startUtc: start + 7200, endUtc: start + 9000, categoryId: 1, description: "late", tz: "Europe/Berlin" };
  const meeting = { seriesId: 1, categoryId: 1, title: "Sync", tz: "America/New_York", startUtc: start, endUtc: start + 1800, originalStartLocal: "2026-10-26T04:00" };
  const rows = exportRows([entry], [meeting], [], "Europe/Berlin", RANGE, () => ({ code: "P-1", name: "A" }));
  expect(rows.map((r) => [r.description, r.start])).toEqual([["Sync", "04:00"], ["late", "11:00"]]);
});

test("Meetings and Absences become rows next to the Entries", () => {
  const start = Date.UTC(2026, 9, 26, 8, 0) / 1000; // 09:00 in Berlin
  const meeting = { seriesId: 1, categoryId: 2, title: "Sync", tz: "Europe/Berlin", startUtc: start, endUtc: start + 1800, originalStartLocal: "2026-10-26T09:00" };
  const part = { id: 1, kind: "Other" as const, label: "Doctor", startDate: null, endDate: null, startUtc: start, endUtc: start + 3600, tz: "Europe/Berlin" };
  const full = { id: 2, kind: "Vacation" as const, label: "", startDate: "2026-10-27", endDate: "2026-10-29", startUtc: null, endUtc: null, tz: null };
  const rows = exportRows([], [meeting], [part, full], "Europe/Berlin", RANGE, (id) => ({ code: `K${id}`, name: `C${id}` }));
  const A = "Absence (not worked)";
  expect(rows).toEqual([
    { date: "2026-10-26", start: "09:00", end: "09:30", minutes: 30, code: "K2", category: "C2", description: "Sync", absence: false },
    { date: "2026-10-26", start: "09:00", end: "10:00", minutes: 60, code: "", category: A, description: "Doctor", absence: true },
    // one row per day inside the timeframe; 29 October is cut off
    { date: "2026-10-27", start: "", end: "", minutes: 0, code: "", category: A, description: "Vacation", absence: true },
    { date: "2026-10-28", start: "", end: "", minutes: 0, code: "", category: A, description: "Vacation", absence: true },
  ]);
});

test("locations get readable names", () => {
  expect(exportDays([{ date: "2026-10-26", location: "home" }])).toEqual([{ date: "2026-10-26", location: "Home" }]);
});

test("the Code column is empty for a Meeting without Category", () => {
  const start = Date.UTC(2026, 9, 26, 8, 0) / 1000;
  const meeting = { seriesId: 1, categoryId: null, title: "Sync", tz: "Europe/Berlin", startUtc: start, endUtc: start + 1800, originalStartLocal: "2026-10-26T09:00" };
  const [row] = exportRows([], [meeting], [], "Europe/Berlin", RANGE, () => ({ code: "P-1", name: "A" }));
  expect([row.code, row.category]).toEqual(["", ""]);
});

test("the file name is by month for a full month and by range otherwise", () => {
  expect(exportFileName("2026-10-01", "2026-10-31")).toBe("work-tracker_2026-10.xlsx");
  expect(exportFileName("2028-02-01", "2028-02-29")).toBe("work-tracker_2028-02.xlsx");
  expect(exportFileName("2026-10-01", "2026-10-30")).toBe("work-tracker_2026-10-01_2026-10-30.xlsx");
  expect(exportFileName("2026-10-26", "2026-11-01")).toBe("work-tracker_2026-10-26_2026-11-01.xlsx");
});

test("the presets start the week on Monday", () => {
  expect(exportPresets("2026-10-28")).toEqual({
    "This week": { from: "2026-10-26", to: "2026-11-01" },
    "Last week": { from: "2026-10-19", to: "2026-10-25" },
    "This month": { from: "2026-10-01", to: "2026-10-31" },
    "Last month": { from: "2026-09-01", to: "2026-09-30" },
  });
  expect(exportPresets("2026-01-15")["Last month"]).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  expect(exportPresets("2026-11-01")["This week"]).toEqual({ from: "2026-10-26", to: "2026-11-01" });
});

test("dates read and write as dd.mm.yyyy", () => {
  expect(formatDmy("2026-10-01")).toBe("01.10.2026");
  expect(parseDmy("01.10.2026")).toBe("2026-10-01");
  expect(parseDmy("1.10.2026")).toBe("2026-10-01");
  expect(parseDmy("31.02.2026")).toBeNull();
  expect(parseDmy("2026-10-01")).toBeNull();
});
