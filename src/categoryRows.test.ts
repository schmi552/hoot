import { expect, test } from "vitest";
import { addMinutes, checkCategories } from "./categoryRows";

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
