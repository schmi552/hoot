import { expect, test } from "vitest";
import { isoWeek, monthTitle, toolbarKey, weekTitle } from "./toolbar";

const day = (y: number, m: number, d: number) => ({ y, m, d });

test("the ISO week starts on Monday and week 1 holds the first Thursday", () => {
  expect(isoWeek(day(2026, 10, 26))).toBe(44);
  expect(isoWeek(day(2026, 11, 1))).toBe(44); // Sunday
  expect(isoWeek(day(2027, 1, 1))).toBe(53); // Friday, the last week of 2026
  expect(isoWeek(day(2024, 12, 30))).toBe(1); // Monday, week 1 of 2025
});

test("the week title shows the ISO week and the shown days", () => {
  expect(weekTitle(day(2026, 10, 26), day(2026, 10, 30))).toBe("Week 44 · 26 – 30 Oct 2026");
  expect(weekTitle(day(2026, 9, 28), day(2026, 10, 2))).toBe("Week 40 · 28 Sep – 2 Oct 2026");
  expect(weekTitle(day(2025, 12, 29), day(2026, 1, 2))).toBe("Week 1 · 29 Dec 2025 – 2 Jan 2026");
});

test("the month title shows the month and the year", () => {
  expect(monthTitle(day(2026, 10, 1))).toBe("October 2026");
});

test("T, W and M move and switch the view when the menu is closed", () => {
  expect(toolbarKey("t", false)).toBe("today");
  expect(toolbarKey("w", false)).toBe("week");
  expect(toolbarKey("m", false)).toBe("month");
});

test("M means New Meeting only while the menu is open", () => {
  expect(toolbarKey("m", true)).toBe("meeting");
  expect(toolbarKey("t", true)).toBe("today");
  expect(toolbarKey("w", true)).toBe("week");
});

test("N, A and I work with the menu open and closed", () => {
  for (const open of [false, true]) {
    expect(toolbarKey("n", open)).toBe("entry");
    expect(toolbarKey("a", open)).toBe("absence");
    expect(toolbarKey("i", open)).toBe("import");
  }
});

test("other keys have no toolbar action", () => {
  expect(toolbarKey("x", false)).toBeNull();
});
