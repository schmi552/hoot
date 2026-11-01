import { expect, test } from "vitest";
import { addMinutes, checkCategories, codeTaken, monthMinutes } from "./categoryRows";

const row = (code: string, name = "") => ({ code, name });

test("a row with a code and no name takes the code as the name", () => {
  const r = checkCategories([row("PSP-1")]);
  expect(r.errors).toEqual([""]);
  expect(r.categories).toEqual([{ code: "PSP-1", name: "PSP-1" }]);
});
test("a row with two empty fields is ignored", () => {
  const r = checkCategories([row("PSP-1", "A"), row("", ""), row("  ", " ")]);
  expect(r.errors).toEqual(["", "", ""]);
  expect(r.categories).toEqual([{ code: "PSP-1", name: "A" }]);
});
test("a name without a code is an error", () => {
  expect(checkCategories([row("", "Support")]).errors[0]).not.toBe("");
});
test("a duplicate code is an error on the second row", () => {
  const r = checkCategories([row("PSP-1", "A"), row(" PSP-1", "B")]);
  expect(r.errors[0]).toBe("");
  expect(r.errors[1]).not.toBe("");
});
test("code and name are trimmed", () => {
  expect(checkCategories([row(" PSP-1 ", " A ")]).categories).toEqual([{ code: "PSP-1", name: "A" }]);
});
test("a lunch length is added to the start", () => {
  expect(addMinutes("12:00", 45)).toBe("12:45");
  expect(addMinutes("23:30", 60)).toBe("");
  expect(addMinutes("", 30)).toBe("");
});

test("month minutes add up per Category and cut an Entry at the month edges", () => {
  const entries = [
    { categoryId: 1, startUtc: 100, endUtc: 900 },
    { categoryId: 1, startUtc: 3000, endUtc: 3600 },
    { categoryId: 2, startUtc: 0, endUtc: 600 },
  ];
  expect(monthMinutes(entries, 300, 3300)).toEqual({ 1: 10 + 5, 2: 5 });
});

test("a code is taken when another Category has it, but an empty code never is", () => {
  expect(codeTaken(" A1 ", [{ code: "A1" }])).toBe(true);
  expect(codeTaken("B", [{ code: "A1" }])).toBe(false);
  expect(codeTaken("", [{ code: "" }])).toBe(false);
});
