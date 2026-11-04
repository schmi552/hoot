import { expect, test } from "vitest";
import { firstCheckIn, needsStartDate, nextMonday, timeProblems, validate } from "./Settings";

const ok = { workStart: "09:00", workEnd: "17:00", lunchStart: "12:00", lunchEnd: "13:00", tz: "UTC", intervalMinutes: 60, workdays: "12345" };

test("good settings have no problem", () => expect(validate(ok)).toBe(""));
test("work must end after it starts", () => expect(validate({ ...ok, workEnd: "08:00" })).not.toBe(""));
test("lunch must be inside work hours", () => expect(validate({ ...ok, lunchEnd: "18:00" })).not.toBe(""));
test("the interval must be positive", () => expect(validate({ ...ok, intervalMinutes: 0, workdays: "12345" })).not.toBe(""));
test("the interval must be a whole number", () => expect(validate({ ...ok, intervalMinutes: 1.5 })).not.toBe(""));
test("a schedule needs a Workday", () => expect(validate({ ...ok, workdays: "" })).not.toBe(""));
test("the start date cannot be in the past", () => {
  expect(validate(ok, "2026-10-29", "2026-10-30")).not.toBe("");
  expect(validate(ok, "2026-10-30", "2026-10-30")).toBe("");
});
test("the start date defaults to the next Monday", () => {
  expect(nextMonday("2026-10-30")).toBe("2026-11-02"); // a Friday
  expect(nextMonday("2026-11-01")).toBe("2026-11-02"); // a Sunday
  expect(nextMonday("2026-11-02")).toBe("2026-11-09"); // a Monday
  expect(nextMonday("2026-12-28")).toBe("2027-01-04"); // over a year end
});
test("the start date shows only when Expected per day or the Workdays change", () => {
  expect(needsStartDate(ok, null)).toBe(false); // first run
  expect(needsStartDate({ ...ok, intervalMinutes: 30 }, ok)).toBe(false);
  expect(needsStartDate({ ...ok, workEnd: "18:00" }, ok)).toBe(true);
  expect(needsStartDate({ ...ok, workdays: "1234" }, ok)).toBe(true);
});
test("each time problem is named for its part", () => {
  expect(timeProblems({ ...ok, workEnd: "08:00" }).work).not.toBe("");
  expect(timeProblems({ ...ok, lunchEnd: "18:00" })).toMatchObject({ work: "" });
  expect(timeProblems({ ...ok, lunchEnd: "18:00" }).lunch).not.toBe("");
  expect(timeProblems({ ...ok, workStart: "" }).work).not.toBe("");
});
test("the first check-in is work start plus one interval", () => {
  expect(firstCheckIn({ ...ok, workStart: "07:00", intervalMinutes: 30 })).toBe("07:30");
  expect(firstCheckIn({ ...ok, workStart: "23:50", intervalMinutes: 30 })).toBe("");
});
