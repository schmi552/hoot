import { invoke } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useEffect, useState } from "react";

export type Settings = {
  workStart: string;
  workEnd: string;
  lunchStart: string;
  lunchEnd: string;
  tz: string;
  intervalMinutes: number;
};
type Category = { id: number; code: string; name: string; color: number };

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
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [autostart, setAutostart] = useState(false);

  const refresh = () => invoke<Category[]>("list_categories").then(setCategories);
  useEffect(() => void refresh(), []);
  useEffect(() => void isEnabled().then(setAutostart, fail), []);

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
  const toggleAutostart = (on: boolean) => (on ? enable() : disable()).then(() => setAutostart(on), fail);
  const save = () => invoke("save_settings", { settings: s }).then(onSaved, fail);
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

      <label className="wt-row">
        <span className="wt-label">Start at login</span>
        <input type="checkbox" checked={autostart} onChange={(e) => toggleAutostart(e.target.checked)} />
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
