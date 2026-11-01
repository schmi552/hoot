import { Ymd, weekday } from "./schedule";

export type ToolbarAction = "today" | "week" | "month" | "entry" | "meeting" | "absence" | "import";

/** The action of a key without a modifier. M selects Month. M selects New Meeting only while the "+" menu is open. */
export function toolbarKey(key: string, menuOpen: boolean): ToolbarAction | null {
  switch (key) {
    case "t": return "today";
    case "w": return "week";
    case "m": return menuOpen ? "meeting" : "month";
    case "n": return "entry";
    case "a": return "absence";
    case "i": return "import";
    default: return null;
  }
}

/** The ISO 8601 week number of a day: weeks start on Monday and week 1 holds the first Thursday. */
export function isoWeek(day: Ymd): number {
  const thursday = Date.UTC(day.y, day.m - 1, day.d + 4 - (weekday(day) || 7));
  const jan1 = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
  return Math.floor((thursday - jan1) / 604_800_000) + 1;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Week 44 · 26 – 30 Oct 2026": the ISO week of the first shown day, then the first and last shown day. */
export function weekTitle(first: Ymd, last: Ymd): string {
  const part = (d: Ymd, year: boolean, month: boolean) => `${d.d}${month ? ` ${MONTHS[d.m - 1]}` : ""}${year ? ` ${d.y}` : ""}`;
  const sameMonth = first.y === last.y && first.m === last.m;
  const from = part(first, first.y !== last.y, !sameMonth);
  return `Week ${isoWeek(first)} · ${from} – ${part(last, true, true)}`;
}

/** "October 2026" */
export const monthTitle = (d: Ymd) => `${FULL_MONTHS[d.m - 1]} ${d.y}`;
