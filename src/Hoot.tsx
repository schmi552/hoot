/** The mascot. A placeholder: a 10 x 9 pixel grid. `px` is the size of one pixel. */
const SPRITE = ["..xxxxxx..", ".xxxxxxxx.", "xxxxxxxxxx", "xxexxxxexx", "xxxxxxxxxx", "xxxmmmmxxx", ".xxxxxxxx.", ".xxxxxxxx.", ".xx.xx.xx."];
const PIXEL = { x: "var(--color-mascot-body)", e: "var(--color-mascot-eye)", m: "var(--color-mascot-beak)" } as Record<string, string>;

export function Hoot({ px }: { px: number }) {
  return (
    <svg aria-hidden="true" width={10 * px} height={9 * px} viewBox="0 0 10 9" shapeRendering="crispEdges" style={{ flex: "none" }}>
      {SPRITE.flatMap((row, y) => [...row].map((c, x) => c !== "." && <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill={PIXEL[c]} />))}
    </svg>
  );
}
