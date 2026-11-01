export type Mood = "asking" | "saved" | "away" | "problem";

/** The mascot, a 12 x 12 pixel grid as on the popup board. Only rows 3 and 4 (the eyes) change between moods. */
const BASE = [".b........b.", ".bb......bb.", ".bbbbbbbbbb.", "bbwwbbbbwwbb", "bbwebbbbewbb", "bbbbbaabbbbb", ".bbllllllbb.", ".bllllllllb.", ".bllvllvllb.", "..bllllllb..", "...bbbbbb...", "...aa..aa..."];
const EYES: Record<Mood, string[]> = {
  asking: [BASE[3], BASE[4]],
  saved: ["bbebbbbbbebb", "bebebbbbebeb"],
  away: ["bbbbbbbbbbbb", "bbeebbbbeebb"],
  problem: ["bwwwbbbbwwwb", "bwewbbbbwewb"],
};
const PIXEL = { b: "body", l: "belly", v: "mark", w: "eye-white", e: "eye", a: "beak" } as Record<string, string>;

export const hootRows = (mood: Mood) => [...BASE.slice(0, 3), ...EYES[mood], ...BASE.slice(5)];

/** `px` is the size of one pixel. Without `show`, an empty space of the same size keeps the place of the sprite. */
export function Hoot({ px, mood = "asking", show = true }: { px: number; mood?: Mood; show?: boolean }) {
  if (!show) return <span aria-hidden="true" style={{ width: 12 * px, flex: "none" }} />;
  return (
    <svg aria-hidden="true" width={12 * px} height={12 * px} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ flex: "none" }}>
      {hootRows(mood).flatMap((row, y) => [...row].map((c, x) => c !== "." && <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill={`var(--color-mascot-${PIXEL[c]})`} />))}
    </svg>
  );
}
