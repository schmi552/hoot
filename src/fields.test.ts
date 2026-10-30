import { expect, test } from "vitest";
import { toggleDay } from "./fields";

test("a Workday toggles on and off and the result stays in week order", () => {
  expect(toggleDay("12345", "6")).toBe("123456");
  expect(toggleDay("12345", "0")).toBe("123450");
  expect(toggleDay("12345", "3")).toBe("1245");
  expect(toggleDay("1", "1")).toBe("");
});
