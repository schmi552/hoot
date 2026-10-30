import { expect, test } from "vitest";
import { exportDays, exportRows } from "./exportRows";

test("an Entry becomes a row in its own zone", () => {
  const start = Date.UTC(2026, 9, 26, 7, 30) / 1000; // 08:30 in Berlin (CET, DST ended on 25 October)
  const rows = exportRows([{ startUtc: start, endUtc: start + 5400, categoryId: 1, description: "x", tz: "Europe/Berlin" }], () => "A");
  expect(rows).toEqual([{ date: "2026-10-26", start: "08:30", end: "10:00", minutes: 90, category: "A", description: "x" }]);
});

test("locations get readable names", () => {
  expect(exportDays([{ date: "2026-10-26", location: "home" }])).toEqual([{ date: "2026-10-26", location: "Home" }]);
});
