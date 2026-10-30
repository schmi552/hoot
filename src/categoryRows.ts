export type CategoryDraft = { code: string; name: string };

/**
 * Checks the Category rows of Onboarding. A row with two empty fields is ignored. Every other row needs a code,
 * and a code cannot repeat. `errors` has one message per row ("" if the row is fine). `categories` holds the rows to save.
 */
export function checkCategories(rows: CategoryDraft[]) {
  const seen = new Set<string>();
  const categories: CategoryDraft[] = [];
  const errors = rows.map((r) => {
    const code = r.code.trim();
    const name = r.name.trim();
    if (!code && !name) return "";
    if (!code) return "Enter a code.";
    if (seen.has(code)) return "This code is already in the list.";
    seen.add(code);
    categories.push({ code, name: name || code });
    return "";
  });
  return { errors, categories };
}

/** "HH:MM" plus `minutes`, or "" if the start is not a time or the result passes midnight. */
export function addMinutes(time: string, minutes: number): string {
  if (!/^\d\d:\d\d$/.test(time)) return "";
  const total = Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + minutes;
  if (total >= 24 * 60) return "";
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
