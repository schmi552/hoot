// Fake Tauri backend for looking at the app in a browser. Used only when MOCK=1 (see vite.config.ts).
import { emitLocal } from "./event";

const tz = "Europe/Zurich";
const day = (d: string, hm: string) => Date.parse(`${d}T${hm}:00${d < "2026-10-25" ? "+02:00" : "+01:00"}`) / 1000; // Zurich is UTC+2 until the clock change on 25 Oct 2026, then UTC+1
const q = new URLSearchParams(location.search);

let settings: any = q.has("empty")
  ? null
  : { workStart: "07:00", workEnd: "16:00", lunchStart: "12:00", lunchEnd: "12:30", tz, intervalMinutes: 30, workdays: "12345" };
let appearance = { theme: q.get("theme") ?? "system", showMascot: true, playSound: true };
const categories = [
  { id: 1, code: "DEV", name: "Development", color: 1 },
  { id: 2, code: "MTG", name: "Meetings", color: 2 },
  { id: 3, code: "ADM", name: "Admin", color: 3 },
  { id: 4, code: "REV", name: "Code review", color: 4 },
];
let nextId = 100;
const entries: any[] = [];
let meetings: any[] = [{ id: 1, categoryId: 2, title: "Standup", startLocal: "2026-10-26T09:30", durationMinutes: 15, tz, rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", sourceFile: null }];
let absences: any[] = [{ id: 1, kind: "vacation", label: "", startDate: "2026-10-30", endDate: "2026-10-30", startUtc: null, endUtc: null, tz: null }];
let locations: any[] = [{ date: "2026-10-26", location: "office" }, { date: "2026-10-27", location: "home" }, { date: "2026-10-28", location: "office" }, { date: "2026-10-29", location: "office" }];
for (const [d, rows] of Object.entries({
  "2026-10-26": [["07:00", "09:30", 1, "Importer"], ["09:45", "12:00", 4, "PR reviews"], ["12:30", "16:00", 1, "Importer"]],
  "2026-10-27": [["07:00", "09:30", 1, "Calendar grid"], ["09:45", "12:00", 3, "Expenses"], ["12:30", "16:00", 1, "Calendar grid"]],
  "2026-10-28": [["07:00", "09:30", 1, "Popup"], ["09:45", "11:30", 4, "Review"], ["12:30", "15:00", 1, "Popup"]],
  "2026-10-29": [["07:00", "09:30", 1, "Settings page"]],
}) as any)
  for (const [a, b, c, desc] of rows) entries.push({ id: nextId++, categoryId: c, description: desc, startUtc: day(d, a), endUtc: day(d, b), tz });
if (q.has("demo")) demoData();

/** `?demo`: five weeks of believable work for the README screenshots. The default data above matches the design boards and stays as it is. */
function demoData() {
  categories.splice(0, categories.length,
    { id: 1, code: "PSP-1042", name: "Platform migration", color: 1 },
    { id: 2, code: "MTG", name: "Meetings", color: 2 },
    { id: 3, code: "PSP-2210", name: "Customer portal", color: 3 },
    { id: 4, code: "REV", name: "Code review", color: 4 },
    { id: 5, code: "ADM", name: "Admin", color: 5 },
  );
  const words: Record<number, string[]> = {
    1: ["Move invoice tables to the new schema", "Write the backfill script", "Fix the failing migration on staging", "Test the rollback of the schema change", "Map the legacy customer fields", "Compare row counts after the copy"],
    3: ["Redesign the login page", "Password reset flow", "Fix the date filter on the order list", "CSV download for the order list", "Accessibility fixes for forms", "Empty state for new customers"],
    4: ["Review PR 214", "Review PR 231 (importer)", "Pair on a flaky test", "Review PR 240 (settings)", "Review the migration plan"],
    5: ["Timesheets and expenses", "Answer support mails", "Plan the next sprint", "Update the onboarding doc", "Sort the backlog"],
  };
  // Per weekday: start, end, category. The Standup sits at 09:30, the Design sync on Tue and Thu at 14:00, the 1:1 on Wed at 11:00.
  const plan: Record<number, [string, string, number][]> = {
    1: [["07:00", "09:30", 1], ["09:45", "12:00", 1], ["12:30", "14:30", 3], ["14:30", "16:00", 4]],
    2: [["07:00", "09:30", 3], ["09:45", "12:00", 3], ["12:30", "14:00", 1], ["14:45", "16:00", 5]],
    3: [["07:00", "09:30", 1], ["09:45", "11:00", 4], ["11:30", "12:00", 5], ["12:30", "16:00", 1]],
    4: [["07:00", "09:30", 3], ["09:45", "12:00", 1], ["12:30", "14:00", 3], ["14:45", "16:00", 4]],
    5: [["07:00", "09:30", 1], ["09:45", "12:00", 5], ["12:30", "16:00", 3]],
  };
  const away = (d: string) => (d >= "2026-10-05" && d <= "2026-10-09") || d === "2026-10-13" || d === "2026-10-30";
  entries.length = 0;
  locations = [];
  for (let t = Date.UTC(2026, 8, 28), i = 0; t <= Date.UTC(2026, 9, 29); t += 86_400_000) {
    const date = new Date(t);
    const wd = date.getUTCDay();
    const d = date.toISOString().slice(0, 10);
    if (wd === 0 || wd === 6 || away(d)) continue;
    locations.push({ date: d, location: wd === 2 || wd === 5 ? "home" : "office" });
    plan[wd].forEach(([a, b, c], slot) => {
      if (d === "2026-10-20" && a >= "14:00") return; // the dentist, below
      if (d === "2026-10-29" && a >= "10:30") return; // it is 10:40 now
      const end = d === "2026-10-29" && b > "10:30" ? "10:30" : b;
      entries.push({ id: nextId++, categoryId: c, description: words[c][(i + slot) % words[c].length], startUtc: day(d, a), endUtc: day(d, end), tz });
    });
    i++;
  }
  meetings = [
    { id: 1, categoryId: 2, title: "Standup", startLocal: "2026-09-28T09:30", durationMinutes: 15, tz, rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", sourceFile: null },
    { id: 2, categoryId: 2, title: "Design sync", startLocal: "2026-09-29T14:00", durationMinutes: 45, tz, rrule: "FREQ=WEEKLY;BYDAY=TU,TH", sourceFile: null },
    { id: 3, categoryId: 2, title: "1:1 with Sam", startLocal: "2026-09-30T11:00", durationMinutes: 30, tz, rrule: "FREQ=WEEKLY", sourceFile: null },
  ];
  absences = [
    { id: 1, kind: "Vacation", label: "", startDate: "2026-10-05", endDate: "2026-10-09", startUtc: null, endUtc: null, tz: null },
    { id: 2, kind: "Sick", label: "", startDate: "2026-10-13", endDate: "2026-10-13", startUtc: null, endUtc: null, tz: null },
    { id: 3, kind: "Other", label: "Dentist", startDate: null, endDate: null, startUtc: day("2026-10-20", "14:00"), endUtc: day("2026-10-20", "15:30"), tz },
    { id: 4, kind: "Vacation", label: "", startDate: "2026-10-30", endDate: "2026-10-30", startUtc: null, endUtc: null, tz: null },
  ];
}

const handlers: Record<string, (a: any) => any> = {
  startup_failure: () => (q.get("fail") ? JSON.parse(q.get("fail")!) : null),
  get_settings: () => settings,
  save_settings: (a) => void (settings = a.settings),
  list_settings_history: () => (settings ? [{ ...settings, effectiveFrom: "2026-01-01" }] : []),
  get_appearance: () => appearance,
  set_theme: (a) => { appearance = { ...appearance, theme: a.theme }; emitLocal("theme-changed", a.theme); },
  set_play_sound: (a) => void (appearance = { ...appearance, playSound: a.play }),
  set_show_mascot: (a) => void (appearance = { ...appearance, showMascot: a.show }),
  list_categories: () => categories,
  used_categories: () => categories.map((c) => c.id),
  add_category: (a) => {
    const c = { id: nextId++, code: a.code, name: a.name, color: 5 };
    categories.push(c);
    return c;
  },
  update_category: (a) => void Object.assign(categories.find((c) => c.id === a.id)!, { code: a.code, color: a.color }),
  remove_category: () => {},
  list_entries: (a) => entries.filter((e) => e.endUtc > a.fromUtc && e.startUtc < a.toUtc),
  create_entry: (a) => void entries.push({ ...a.entry, id: nextId++ }),
  update_entry: (a) => void Object.assign(entries.find((e) => e.id === a.entry.id) ?? {}, a.entry),
  delete_entry: (a) => void entries.splice(entries.findIndex((e) => e.id === a.id), 1),
  list_meetings: () => meetings,
  list_meeting_exceptions: () => [],
  create_meeting: (a) => void meetings.push({ ...a.meeting, id: nextId++ }),
  update_meeting: () => {},
  delete_meeting: () => {},
  set_meeting_exception: () => {},
  import_meetings: () => [],
  list_absences: () => absences,
  create_absence: () => {},
  delete_absence: () => {},
  list_workday_locations: (a) => locations.filter((l) => l.date >= a.from && l.date <= a.to),
  set_workday_location: () => {},
  latest_backup: () => ({ name: "tracker-2026-10-29.db", modifiedUtc: day("2026-10-29", "07:02") }),
  show_backups_folder: () => {},
  show_in_folder: () => {},
  export_xlsx: () => {},
  quit: () => {},
  set_popup_visible: () => {},
  report_save_failure: () => {},
};

export const invoke = async (cmd: string, args: any = {}) => {
  const h = handlers[cmd];
  if (!h) throw new Error(`mock: no handler for ${cmd}`);
  return h(args);
};

// The clock stands on the fixed board date: Thursday 29 October 2026, 10:40 in Zurich (or ?now=HH:MM). It keeps running.
const offset = day("2026-10-29", q.get("now") ?? "10:40") * 1000 - Date.now(); // ?now=HH:MM moves the clock
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...a: any[]) { super(...(a.length ? (a as [any]) : [RealDate.now() + offset])); }
  static now() { return RealDate.now() + offset; }
} as DateConstructor;

(globalThis as any).__emit = emitLocal; // lets a browser session fire events, e.g. __emit("debug-popup")
