import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export type Settings = {
  workStart: string;
  workEnd: string;
  lunchStart: string;
  lunchEnd: string;
  tz: string;
  intervalMinutes: number;
};
type Category = { id: number; name: string };

const defaults = (): Settings => ({
  workStart: "09:00",
  workEnd: "17:00",
  lunchStart: "12:00",
  lunchEnd: "13:00",
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  intervalMinutes: 60,
});

/** "HH:MM" strings sort in time order. Returns the first problem, or "" if there is none. */
export function validate(s: Settings): string {
  if (s.workEnd <= s.workStart) return "Work must end after it starts.";
  if (s.lunchEnd <= s.lunchStart) return "Lunch must end after it starts.";
  if (s.lunchStart < s.workStart || s.lunchEnd > s.workEnd) return "Lunch must be inside work hours.";
  if (!Number.isInteger(s.intervalMinutes) || s.intervalMinutes < 1) return "The interval must be a whole number of minutes, at least 1.";
  return "";
}

/** One form for first run (`saved` is null) and for later changes. A save applies from today on. */
export function SettingsForm({ saved, onSaved }: { saved: Settings | null; onSaved: () => void }) {
  const [s, setS] = useState<Settings>(saved ?? defaults());
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const refresh = () => invoke<Category[]>("list_categories").then(setCategories);
  useEffect(() => void refresh(), []);

  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setS({ ...s, [k]: k === "intervalMinutes" ? e.target.valueAsNumber : e.target.value });
  const field = (label: string, k: keyof Settings, type = "time") => (
    <label className="wt-row">
      <span className="wt-label">{label}</span>
      <input className="wt-input" type={type} value={s[k]} onChange={set(k)} required />
    </label>
  );

  const problem = validate(s);
  const fail = (e: unknown) => setMessage(String(e));
  const save = () => invoke("save_settings", { settings: s }).then(onSaved, fail);
  const add = () =>
    invoke("add_category", { name: name.trim() }).then(() => {
      setName("");
      setMessage("");
      refresh();
    }, fail);
  const remove = (c: Category) =>
    invoke<boolean>("remove_category", { id: c.id }).then((archived) => {
      setMessage(archived ? `${c.name} has Entries, so it is archived.` : "");
      refresh();
    }, fail);

  return (
    <main className="wt-startup">
      <h1>{saved ? "Settings" : "Welcome. Set up Work Tracker"}</h1>
      <p>{saved ? "A change applies from today on." : "You can change all of this later."}</p>
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
        <p className="wt-error" role="alert">{problem}</p>
        <button className="wt-chip is-primary" type="submit" disabled={!!problem}>
          {saved ? "Save" : "Start"}
        </button>
      </form>

      <h2>Categories</h2>
      <ul>
        {categories.map((c) => (
          <li key={c.id}>
            {c.name} <button className="wt-chip" onClick={() => remove(c)}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="wt-startup-actions">
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
