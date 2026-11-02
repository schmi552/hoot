// Fake Tauri backend for looking at the app in a browser. Used only when MOCK=1 (see vite.config.ts).
import { emitLocal } from "./event";

const tz = "Europe/Zurich";
const day = (d: string, hm: string) => Date.parse(`${d}T${hm}:00+01:00`) / 1000; // after the 25 Oct 2026 clock change, Zurich is UTC+1
const q = new URLSearchParams(location.search);

let settings: any = q.has("empty")
  ? null
  : { workStart: "07:00", workEnd: "16:00", lunchStart: "12:00", lunchEnd: "12:30", tz, intervalMinutes: 30, workdays: "12345" };
let appearance = { theme: q.get("theme") ?? "system", showMascot: true };
const categories = [
  { id: 1, code: "DEV", name: "Development", color: 1 },
  { id: 2, code: "MTG", name: "Meetings", color: 2 },
  { id: 3, code: "ADM", name: "Admin", color: 3 },
  { id: 4, code: "REV", name: "Code review", color: 4 },
];
let nextId = 100;
const entries: any[] = [];
for (const [d, rows] of Object.entries({
  "2026-10-26": [["07:00", "09:30", 1, "Importer"], ["09:30", "12:00", 4, "PR reviews"], ["12:30", "16:00", 1, "Importer"]],
  "2026-10-27": [["07:00", "10:00", 1, "Calendar grid"], ["10:00", "12:00", 3, "Expenses"], ["12:30", "16:00", 1, "Calendar grid"]],
  "2026-10-28": [["07:00", "11:00", 1, "Popup"], ["11:00", "12:00", 4, "Review"], ["12:30", "15:00", 1, "Popup"]],
  "2026-10-29": [["07:00", "09:00", 1, "Settings page"], ["09:00", "10:30", 3, "Planning"]],
}) as any)
  for (const [a, b, c, desc] of rows) entries.push({ id: nextId++, categoryId: c, description: desc, startUtc: day(d, a), endUtc: day(d, b), tz });
const meetings: any[] = [{ id: 1, categoryId: 2, title: "Standup", startLocal: "2026-10-26T09:30", durationMinutes: 15, tz, rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", sourceFile: null }];
const absences: any[] = [{ id: 1, kind: "vacation", label: "", startDate: "2026-10-30", endDate: "2026-10-30", startUtc: null, endUtc: null, tz: null }];
const locations: any[] = [{ date: "2026-10-26", location: "office" }, { date: "2026-10-27", location: "home" }, { date: "2026-10-28", location: "office" }];

const handlers: Record<string, (a: any) => any> = {
  startup_failure: () => (q.get("fail") ? JSON.parse(q.get("fail")!) : null),
  get_settings: () => settings,
  save_settings: (a) => void (settings = a.settings),
  list_settings_history: () => (settings ? [{ ...settings, effectiveFrom: "2026-01-01" }] : []),
  get_appearance: () => appearance,
  set_theme: (a) => { appearance = { ...appearance, theme: a.theme }; emitLocal("theme-changed", a.theme); },
  set_show_mascot: (a) => void (appearance = { ...appearance, showMascot: a.show }),
  list_categories: () => categories,
  used_categories: () => [1, 2, 3],
  add_category: (a) => void categories.push({ id: nextId++, code: a.code, name: a.name, color: 5 }),
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
  set_popup_visible: () => {},
  report_save_failure: () => {},
};

export const invoke = async (cmd: string, args: any = {}) => {
  const h = handlers[cmd];
  if (!h) throw new Error(`mock: no handler for ${cmd}`);
  return h(args);
};

// The clock stands on the fixed board date: Thursday 29 October 2026, 10:40 in Zurich. It keeps running.
const offset = day("2026-10-29", "10:40") * 1000 - Date.now();
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...a: any[]) { super(...(a.length ? (a as [any]) : [RealDate.now() + offset])); }
  static now() { return RealDate.now() + offset; }
} as DateConstructor;

(globalThis as any).__emit = emitLocal; // lets a browser session fire events, e.g. __emit("debug-popup")
