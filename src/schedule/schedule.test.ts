import { expect, test } from "vitest";
import { minutesBetween } from "./schedule";

test("minutesBetween counts minutes between two epoch-second instants", () => {
  expect(minutesBetween(1_000, 1_000 + 90 * 60)).toBe(90);
});
