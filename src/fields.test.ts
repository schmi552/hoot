import { expect, test } from "vitest";
import { parseMinutes, parseTime, toggleDay } from "./fields";

test("a Workday toggles on and off and the result stays in week order", () => {
  expect(toggleDay("12345", "6")).toBe("123456");
  expect(toggleDay("12345", "0")).toBe("123450");
  expect(toggleDay("12345", "3")).toBe("1245");
  expect(toggleDay("1", "1")).toBe("");
});

test("a typed time is read into HH:MM, and a bad time gives an empty text", () => {
  expect(parseTime("7:05")).toBe("07:05");
  expect(parseTime("0705")).toBe("07:05");
  expect(parseTime(" 16:30 ")).toBe("16:30");
  expect(parseTime("24:00")).toBe("");
  expect(parseTime("12:60")).toBe("");
  expect(parseTime("noon")).toBe("");
});

test("typed minutes are read into N min, and a bad text gives an empty text", () => {
  expect(parseMinutes("45")).toBe("45 min");
  expect(parseMinutes(" 20 min ")).toBe("20 min");
  expect(parseMinutes("0")).toBe("");
  expect(parseMinutes("1.5")).toBe("");
  expect(parseMinutes("soon")).toBe("");
});
