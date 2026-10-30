import { invoke } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useEffect, useState } from "react";
import { Appearance, Theme } from "./theme";
import { dateKey, expectedMinutes, instantAt, weekday, ymdIn } from "./schedule/schedule";

export type Settings = {
  workStart: string;
  workEnd: string;
  lunchStart: string;
  lunchEnd: string;
  tz: string;
  intervalMinutes: number;
  /** Weekday digits of the Workdays, 0 is Sunday. */
  workdays: string;
};
type Category = { id: number; code: string; name: string; color: number };

const defaults = (): Settings => ({
  workStart: "09:00",
  workEnd: "17:00",
  lunchStart: "12:00",
  lunchEnd: "13:00",
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  intervalMinutes: 60,
  workdays: "12345",
});

/** Monday to Sunday, as the weekday digit and the label. */
const DAYS: [string, string][] = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]];

/** The next Monday after `today` ("YYYY-MM-DD"). On a Monday it is a week later. */
export function nextMonday(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const ymd = { y, m, d: d + 8 - (weekday({ y, m, d }) || 7) };
  return dateKey(ymdIn("UTC", instantAt("UTC", ymd)));
}

/** True if a save needs a start date: Expected per day or the Workdays differ from `saved`. Else the save starts today. */
export const needsStartDate = (s: Settings, saved: Settings | null) =>
  !!saved && (expectedMinutes(s) !== expectedMinutes(saved) || s.workdays !== saved.workdays);

/** "HH:MM" strings sort in time order. Returns the first problem, or "" if there is none. */
export function validate(s: Settings, start = "", today = ""): string {
  if (s.workEnd <= s.workStart) return "Work must end after it starts.";
  if (s.lunchEnd <= s.lunchStart) return "Lunch must end after it starts.";
  if (s.lunchStart < s.workStart || s.lunchEnd > s.workEnd) return "Lunch must be inside work hours.";
  if (!Number.isInteger(s.intervalMinutes) || s.intervalMinutes < 1) return "The interval must be a whole number of minutes, at least 1.";
  if (!s.workdays) return "Choose at least one Workday.";
  if (start < today) return "The start date cannot be in the past.";
  return "";
}

/** One form for first run (`saved` is null) and for later changes. A save starts today, or on the start date when Expected per day changes. */
export function SettingsForm({ saved, onSaved }: { saved: Settings | null; onSaved: () => void }) {
  const [s, setS] = useState<Settings>(saved ?? defaults());
  const [categories, setCategories] = useState<Category[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [autostart, setAutostart] = useState(false);
  const [look, setLook] = useState<Appearance>({ theme: "system", showMascot: true });
  const today = dateKey(ymdIn(s.tz, Date.now() / 1000));
  const [from, setFrom] = useState(nextMonday(today));
  const dated = needsStartDate(s, saved);
  const start = dated ? from : today;

  const refresh = () => invoke<Category[]>("list_categories").then(setCategories);
  useEffect(() => void refresh(), []);
  useEffect(() => void invoke<Appearance>("get_appearance").then(setLook, fail), []);
  useEffect(() => void isEnabled().then(setAutostart, fail), []);

  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setS({ ...s, [k]: k === "intervalMinutes" ? e.target.valueAsNumber : e.target.value });
  const field = (label: string, k: keyof Settings, type = "time") => (
    <label className="wt-row">
      <span className="wt-label">{label}</span>
      <input className="wt-input" type={type} value={s[k]} onChange={set(k)} required />
    </label>
  );

  const problem = validate(s, start, today);
  const fail = (e: unknown) => setMessage(String(e));
  const toggleAutostart = (on: boolean) => (on ? enable() : disable()).then(() => setAutostart(on), fail);
  const setTheme = (theme: Theme) => invoke("set_theme", { theme }).then(() => setLook({ ...look, theme }), fail);
  const setShowMascot = (showMascot: boolean) => invoke("set_show_mascot", { show: showMascot }).then(() => setLook({ ...look, showMascot }), fail);
  const save = () => invoke("save_settings", { settings: s, start }).then(onSaved, fail);
  const add = () =>
    invoke("add_category", { code: code.trim(), name: name.trim() }).then(() => {
      setCode("");
      setName("");
      setMessage("");
      refresh();
    }, fail);
  const change = (c: Category, patch: Partial<Category>) => {
    const n = { ...c, ...patch };
    invoke("update_category", { id: c.id, code: n.code.trim(), color: n.color }).then(() => setMessage(""), fail).then(refresh);
  };
  const remove = (c: Category) =>
    invoke<boolean>("remove_category", { id: c.id }).then((archived) => {
      setMessage(archived ? `${c.name} has Entries, so it is archived.` : "");
      refresh();
    }, fail);

  return (
    <main className="wt-startup">
      <h1>{saved ? "Settings" : "Welcome. Set up Work Tracker"}</h1>
      <p>{saved ? "A change applies from the start date." : "You can change all of this later."}</p>
      <form
        className="wt-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!problem) save();
        }}
      >
        {field("Work starts", "workStart")}
        {field("Work ends", "workEnd")}
        {field("Lunch starts", "lunchStart")}
        {field("Lunch ends", "lunchEnd")}
        {field("Popup every (minutes)", "intervalMinutes", "number")}
        <fieldset className="wt-row">
          <legend className="wt-label">Workdays</legend>
          {DAYS.map(([digit, label]) => (
            <label key={digit}>
              <input
                type="checkbox"
                checked={s.workdays.includes(digit)}
                onChange={(e) => setS({ ...s, workdays: DAYS.map(([d]) => d).filter((d) => (d === digit ? e.target.checked : s.workdays.includes(d))).join("") })}
              />{" "}
              {label}{" "}
            </label>
          ))}
        </fieldset>
        {dated && (
          <label className="wt-row">
            <span className="wt-label">From</span>
            <input className="wt-input" type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} required />
          </label>
        )}
        <p className="wt-error" role="alert">{problem}</p>
        <button className="wt-chip is-primary" type="submit" disabled={!!problem}>
          {saved ? "Save" : "Start"}
        </button>
      </form>

      <label className="wt-row">
        <span className="wt-label">Start at login</span>
        <input type="checkbox" checked={autostart} onChange={(e) => toggleAutostart(e.target.checked)} />
      </label>

      <label className="wt-row">
        <span className="wt-label">Theme</span>
        <select className="wt-input" value={look.theme} onChange={(e) => setTheme(e.target.value as Theme)}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label className="wt-row">
        <span className="wt-label">Show the mascot</span>
        <input type="checkbox" checked={look.showMascot} onChange={(e) => setShowMascot(e.target.checked)} />
      </label>

      <h2>Categories</h2>
      <ul>
        {categories.map((c) => (
          <li key={c.id}>
            <input
              key={c.code}
              className="wt-input"
              aria-label={`Code of ${c.name}`}
              size={8}
              defaultValue={c.code}
              onBlur={(e) => e.target.value.trim() !== c.code && change(c, { code: e.target.value })}
            />{" "}
            {c.name}{" "}
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Color ${n} for ${c.name}`}
                aria-pressed={c.color === n}
                onClick={() => change(c, { color: n })}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: c.color === n ? "2px solid var(--color-text)" : "1px solid transparent",
                  background: `var(--cat-${n}-solid)`,
                }}
              />
            ))}{" "}
            <button className="wt-chip" onClick={() => remove(c)}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="wt-startup-actions">
        <input className="wt-input" aria-label="New Category code" size={8} placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
        <input
          className="wt-input"
          aria-label="New Category"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && add()}
        />
        <button className="wt-chip" onClick={add} disabled={!name.trim()}>Add Category</button>
      </div>
      <p className="wt-error" role="alert">{message}</p>

      <button className="wt-chip" onClick={() => invoke("show_backups_folder")}>Show backups folder</button>
    </main>
  );
}
