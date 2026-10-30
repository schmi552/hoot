import { expect, test } from "vitest";
import { Absence, absenceTitle } from "./absences";

const base: Absence = { id: 1, kind: "Vacation", label: "", startDate: "2026-08-03", endDate: "2026-08-07", startUtc: null, endUtc: null, tz: null };
const part: Absence = { ...base, kind: "Other", label: "", startDate: null, endDate: null, startUtc: 0, endUtc: 3600, tz: "UTC" };

test("a full-day Absence shows the kind first and then the label if set", () => {
  expect(absenceTitle(base)).toBe("Vacation");
  expect(absenceTitle({ ...base, label: "Mallorca" })).toBe("Vacation: Mallorca");
});

test("a part-day Absence shows the label if set, and the kind if not", () => {
  expect(absenceTitle({ ...part, label: "Doctor" })).toBe("Doctor");
  expect(absenceTitle({ ...part, kind: "Sick" })).toBe("Sick");
});
