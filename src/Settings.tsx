import { invoke } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useEffect, useRef, useState } from "react";
import { addMinutes } from "./categoryRows";
import { DayPicker, MinutesField, TimeField, TimeSpanField } from "./fields";
import { Hoot } from "./Hoot";
import { Backups, Categories, RecurringMeetings } from "./SettingsData";
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

/** The board defaults. */
export const defaults = (): Settings => ({
  workStart: "07:00",
  workEnd: "16:00",
  lunchStart: "12:00",
  lunchEnd: "12:30",
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  intervalMinutes: 30,
  workdays: "12345",
});

/** The next Monday after `today` ("YYYY-MM-DD"). On a Monday it is a week later. */
export function nextMonday(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const ymd = { y, m, d: d + 8 - (weekday({ y, m, d }) || 7) };
  return dateKey(ymdIn("UTC", instantAt("UTC", ymd)));
}

/** True if a save needs a start date: Expected per day or the Workdays differ from `saved`. Else the save starts today. */
export const needsStartDate = (s: Settings, saved: Settings | null) =>
  !!saved && (expectedMinutes(s) !== expectedMinutes(saved) || s.workdays !== saved.workdays);

const isTime = (t: string) => /^\d\d:\d\d$/.test(t);

/** The problem with the work times and with the lunch times, each "" if there is none. "HH:MM" strings sort in time order. */
export function timeProblems(s: Settings) {
  const work = !isTime(s.workStart) || !isTime(s.workEnd) ? "Enter the work times as HH:MM." : s.workEnd <= s.workStart ? "Work must end after it starts." : "";
  const lunch = !isTime(s.lunchStart) || !isTime(s.lunchEnd)
    ? "Enter the lunch times as HH:MM."
    : s.lunchEnd <= s.lunchStart
      ? "Lunch must end after it starts."
      : s.lunchStart < s.workStart || s.lunchEnd > s.workEnd
        ? "Lunch must be inside work hours."
        : "";
  return { work, lunch };
}

/** Returns the first problem, or "" if there is none. */
export function validate(s: Settings, start = "", today = ""): string {
  const t = timeProblems(s);
  if (t.work || t.lunch) return t.work || t.lunch;
  if (!Number.isInteger(s.intervalMinutes) || s.intervalMinutes < 1) return "The interval must be a whole number of minutes, at least 1.";
  if (!s.workdays) return "Choose at least one Workday.";
  if (start < today) return "The start date cannot be in the past.";
  return "";
}

export const INTERVALS = [15, 30, 45, 60];
const LUNCH_MINUTES = [15, 30, 45, 60, 90];
const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** "8h 30m" for a number of minutes. */
export const hours = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;

/** "HH:MM" of the first check-in of a day: work start plus one interval. "" if it passes midnight. */
export const firstCheckIn = (s: Settings) => addMinutes(s.workStart, s.intervalMinutes);

/** Work time: the schedule fields. Nothing is saved until "Save changes". `key` the component on `saved` to reset it. */
function WorkTime({ saved, onSaved }: { saved: Settings; onSaved: () => void }) {
  const [s, setS] = useState(saved);
  const [message, setMessage] = useState("");
  const today = dateKey(ymdIn(s.tz, Date.now() / 1000));
  const [from, setFrom] = useState(nextMonday(today));
  const dated = needsStartDate(s, saved);
  const start = dated ? from : today;

  const next = s;
  const problem = validate(next, start, today);
  const time = timeProblems(next);
  const lunchMinutes = minutesOf(s.lunchEnd) - minutesOf(s.lunchStart);
  const before = expectedMinutes(saved);
  const after = expectedMinutes(next);
  const reset = () => {
    setS(saved);
    setFrom(nextMonday(today));
    setMessage("");
  };
  const save = () => invoke("save_settings", { settings: next, start }).then(onSaved, (e) => setMessage(String(e)));

  return (
    <section id="work" className="wt-section">
      <h2>Work time</h2>
      <form
        className="wt-section"
        onSubmit={(e) => {
          e.preventDefault();
          if (!problem) save();
        }}
      >
        <div className="wt-fields wt-fields-grid">
          <TimeField label="From" value={s.workStart} onChange={(workStart) => setS({ ...s, workStart })} invalid={!!time.work} />
          <TimeField label="To" value={s.workEnd} onChange={(workEnd) => setS({ ...s, workEnd })} invalid={!!time.work} />
          <TimeSpanField
            label="Lunch"
            time={s.lunchStart}
            minutes={lunchMinutes}
            minuteOptions={LUNCH_MINUTES}
            onTime={(lunchStart) => setS({ ...s, lunchStart, lunchEnd: addMinutes(lunchStart, lunchMinutes) || s.lunchEnd })}
            onMinutes={(m) => setS({ ...s, lunchEnd: addMinutes(s.lunchStart, m) || s.lunchEnd })}
            invalid={!!time.lunch}
          />
          <MinutesField label="Check-in every" value={s.intervalMinutes} options={INTERVALS} onChange={(intervalMinutes) => setS({ ...s, intervalMinutes })} />
        </div>
        <div className="wt-field">
          <span className="wt-label">Workdays</span>
          <DayPicker value={s.workdays} onChange={(workdays) => setS({ ...s, workdays })} />
        </div>
        {dated && (
          <div role="status" className="wt-notice wt-notice-row">
            <div className="wt-notice-text">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 7.5V11M8 5v.01" /></svg>
              <span>
                {before === after ? (
                  "The Workdays change."
                ) : (
                  <>Expected per day changes from <b className="wt-mono">{hours(before)}</b> to <b className="wt-mono">{hours(after)}</b>.</>
                )}{" "}
                Weeks before the start date keep the old value.
              </span>
            </div>
            <label className="wt-notice-date">
              From
              <input className="wt-input wt-mono" type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={start < today} />
            </label>
          </div>
        )}
        <p className="wt-error" role="alert">{message || problem}</p>
        <div className="wt-actions">
          <button type="button" className="wt-chip" onClick={reset}>Discard</button>
          <button type="submit" className="wt-chip is-primary" disabled={!!problem}>Save changes</button>
        </div>
      </form>
    </section>
  );
}

/** The settings screen. `onBack` leaves with no warning, so unsaved Work time edits are dropped. A save calls `onSaved`. */
const SECTIONS = [["work", "Work time"], ["cats", "Categories"], ["meetings", "Recurring Meetings"], ["look", "Appearance and startup"], ["back", "Backups"]] as const;

export function SettingsForm({ saved, onSaved, onBack }: { saved: Settings; onSaved: () => void; onBack: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState("");
  const [autostart, setAutostart] = useState(false);
  const [look, setLook] = useState<Appearance>({ theme: "light", showMascot: true });
  const [active, setActive] = useState<string>(SECTIONS[0][0]); // the menu item of the section in view
  const picked = useRef(false); // a click on the menu holds its item until the user scrolls by hand
  useEffect(() => {
    // The page scrolls in a wide window and the content column in a narrow one, so listen to both.
    const main = document.querySelector(".wt-settings-main");
    const update = () => {
      if (picked.current) return;
      const bottom = (el: Element | null) => !!el && el.scrollHeight > el.clientHeight && el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      const atEnd = bottom(main) || bottom(document.documentElement);
      const inView = SECTIONS.filter(([id]) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= 140);
      setActive(atEnd ? SECTIONS[SECTIONS.length - 1][0] : (inView[inView.length - 1] ?? SECTIONS[0])[0]);
    };
    const release = () => (picked.current = false);
    main?.addEventListener("scroll", update);
    window.addEventListener("scroll", update);
    window.addEventListener("wheel", release);
    window.addEventListener("touchmove", release);
    return () => (main?.removeEventListener("scroll", update), window.removeEventListener("scroll", update), window.removeEventListener("wheel", release), window.removeEventListener("touchmove", release));
  }, []);

  const refresh = () => invoke<Category[]>("list_categories").then(setCategories);
  useEffect(() => void refresh(), []);
  useEffect(() => void invoke<Appearance>("get_appearance").then(setLook, fail), []);
  useEffect(() => void isEnabled().then(setAutostart, fail), []);

  const fail = (e: unknown) => setMessage(String(e));
  const toggleAutostart = (on: boolean) => (on ? enable() : disable()).then(() => setAutostart(on), fail);
  const setTheme = (theme: Theme) => invoke("set_theme", { theme }).then(() => setLook({ ...look, theme }), fail);
  const setShowMascot = (showMascot: boolean) => invoke("set_show_mascot", { show: showMascot }).then(() => setLook({ ...look, showMascot }), fail);

  return (
    <div className="wt-settings">
      <header className="wt-settings-head">
        <div className="wt-toolbar-group">
          <Hoot px={3} show={look.showMascot} />
          <span className="wt-toolbar-name">Hoot</span>
          <button type="button" className="wt-icon-btn wt-back" aria-label="Back to calendar" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
          </button>
          <h1 className="wt-toolbar-title">Settings</h1>
        </div>
      </header>
      <div className="wt-settings-body">
        <nav aria-label="Settings sections" className="wt-settings-nav">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} aria-current={active === id ? "true" : undefined} onClick={() => (picked.current = true, setActive(id))}>{label}</a>
          ))}
        </nav>
        <main className="wt-settings-main">
          <WorkTime key={JSON.stringify(saved)} saved={saved} onSaved={onSaved} />

          <Categories settings={saved} categories={categories} refresh={refresh} />

          <RecurringMeetings settings={saved} categories={categories} />

          <section id="look" className="wt-section">
            <h2>Appearance and startup</h2>
            <div className="wt-row-wrap">
              <span className="wt-label">Theme</span>
              <div role="group" aria-label="Theme" className="wt-chips">
                {(["system", "light", "dark"] as Theme[]).map((t) => (
                  <button key={t} type="button" className="wt-chip" aria-pressed={look.theme === t} onClick={() => setTheme(t)}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <label className="wt-check">
              <input type="checkbox" checked={autostart} onChange={(e) => toggleAutostart(e.target.checked)} />
              Open Hoot when I log in
            </label>
            <label className="wt-check">
              <input type="checkbox" checked={look.showMascot} onChange={(e) => setShowMascot(e.target.checked)} />
              Show the mascot
            </label>
            {message && <p className="wt-error" role="alert">{message}</p>}
          </section>

          <Backups tz={saved.tz} />
        </main>
      </div>
    </div>
  );
}
