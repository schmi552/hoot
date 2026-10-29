import { expect, test } from "vitest";
import { validate } from "./Settings";

const ok = { workStart: "09:00", workEnd: "17:00", lunchStart: "12:00", lunchEnd: "13:00", tz: "UTC", intervalMinutes: 60 };

test("good settings have no problem", () => expect(validate(ok)).toBe(""));
test("work must end after it starts", () => expect(validate({ ...ok, workEnd: "08:00" })).not.toBe(""));
test("lunch must be inside work hours", () => expect(validate({ ...ok, lunchEnd: "18:00" })).not.toBe(""));
test("the interval must be positive", () => expect(validate({ ...ok, intervalMinutes: 0 })).not.toBe(""));
