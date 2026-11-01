import { expect, test } from "vitest";
import { hootRows, Mood } from "./Hoot";

test("every mood is a 12 x 12 grid and only the eyes change", () => {
  const asking = hootRows("asking");
  for (const mood of ["asking", "saved", "away", "problem"] as Mood[]) {
    const rows = hootRows(mood);
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => r.length === 12)).toBe(true);
    expect(rows.filter((r, i) => r !== asking[i]).length).toBeLessThanOrEqual(2);
  }
});
