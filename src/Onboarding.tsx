import { invoke } from "@tauri-apps/api/core";
import { enable } from "@tauri-apps/plugin-autostart";
import { useEffect, useId, useRef, useState } from "react";
import { ChipGroup, DayPicker, TimeField } from "./fields";
import { Hoot } from "./Hoot";
import { addMinutes, checkCategories, CategoryDraft } from "./categoryRows";
import { defaults, hours, INTERVALS, Settings, timeProblems, validate } from "./Settings";
import { dateKey, expectedMinutes, ymdIn } from "./schedule/schedule";

const COLOR_NAMES = ["Blue", "Orange", "Teal", "Purple", "Green", "Pink", "Amber", "Slate"];
const LUNCH_MINUTES = [30, 45, 60];
const emptyRow = (): CategoryDraft => ({ code: "", name: "" });
/** One numbered step of the card. The title names the group for screen readers. */
function Step({ n, title, children }: { n: number; title: React.ReactNode; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="wt-step" role="group" aria-labelledby={id}>
      <span className="wt-step-n">{n}</span>
      <div className="wt-step-body">
        <div id={id} className="wt-step-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

/** The first-run card. It saves the first settings, the Categories and "Start at login", then calls `onDone`. With `demo`, nothing is saved. */
export function Onboarding({ onDone, demo }: { onDone: () => void; demo?: boolean }) {
  const [base] = useState(defaults);
  const [workStart, setWorkStart] = useState(base.workStart);
  const [workEnd, setWorkEnd] = useState(base.workEnd);
  const [workdays, setWorkdays] = useState(base.workdays);
  const [lunchStart, setLunchStart] = useState(base.lunchStart);
  const [lunchMinutes, setLunchMinutes] = useState(30);
  const [interval, setIntervalMinutes] = useState(base.intervalMinutes);
  const [autostart, setAutostart] = useState(true);
  const [rows, setRows] = useState<CategoryDraft[]>([emptyRow()]);
  const [message, setMessage] = useState("");

  const s: Settings = { ...base, workStart, workEnd, workdays, lunchStart, lunchEnd: addMinutes(lunchStart, lunchMinutes), intervalMinutes: interval };
  const time = timeProblems(s);
  const cats = checkCategories(rows);
  const problem = validate(s, "", "") || cats.errors.find(Boolean) || "";
  const firstCheckIn = time.work ? "" : addMinutes(workStart, interval);

  const focusNew = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  // After Enter adds a row, the new row's Code field takes the focus.
  useEffect(() => {
    if (!focusNew.current) return;
    focusNew.current = false;
    listRef.current?.querySelector<HTMLInputElement>("[data-last] input")?.focus();
  }, [rows.length]);

  const setRow = (i: number, patch: Partial<CategoryDraft>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => (setRows([...rows, emptyRow()]), (focusNew.current = true));
  // Enter adds the next row. It does not submit the form.
  const enterAdds = (i: number) => (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (i === rows.length - 1) addRow();
  };
  // A row that is saved leaves the list, so a retry after a failure does not add it twice.
  const save = async () => {
    if (demo) return onDone();
    try {
      const today = dateKey(ymdIn(s.tz, Date.now() / 1000));
      await invoke("save_settings", { settings: s, start: today });
      let left = rows;
      for (const c of cats.categories) {
        await invoke("add_category", c);
        left = left.filter((r) => r.code.trim() !== c.code);
        setRows(left.length ? left : [emptyRow()]);
      }
      if (autostart) await enable();
      onDone();
    } catch (e) {
      setMessage(String(e));
    }
  };

  let filled = 0;
  return (
    <main className="wt-ob">
      <div className="wt-ob-inner">
        <div className="wt-ob-hello">
          <Hoot px={5} />
          <div className="wt-bubble wt-ob-bubble">
            <h1>Hi! I keep your work log.</h1>
            <span>Four quick answers, then I stay out of your way. You can change all of this later in Settings.</span>
          </div>
        </div>

        <form
          className="wt-ob-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (!problem) save();
          }}
        >
          <Step n={1} title="When do you usually work?">
              <div className="wt-fields">
                <TimeField label="From" value={workStart} onChange={setWorkStart} invalid={!!time.work} />
                <TimeField label="To" value={workEnd} onChange={setWorkEnd} invalid={!!time.work} />
                <DayPicker value={workdays} onChange={setWorkdays} />
              </div>
              <p className="wt-error">{time.work || (workdays ? "" : "Choose at least one Workday.")}</p>
            </Step>

          <Step n={2} title="When is your lunch break?">
              <div className="wt-fields">
                <TimeField label="Starts at" value={lunchStart} onChange={setLunchStart} invalid={!!time.lunch} />
                <ChipGroup label="Lunch length" options={LUNCH_MINUTES} value={lunchMinutes} onChange={setLunchMinutes} suffix=" min" />
              </div>
              <p className="wt-error">{time.lunch}</p>
              {!time.work && !time.lunch && <span className="wt-hint wt-mono">Expected per day: {hours(expectedMinutes(s))}</span>}
            </Step>

          <Step n={3} title={<>Which Categories do you book on? <span className="wt-sub">Optional</span></>}>
              <div className="wt-cat-rows" ref={listRef}>
                {rows.map((r, i) => {
                  const used = !!(r.code.trim() || r.name.trim());
                  const color = (filled % 8) + 1;
                  if (used) filled++;
                  const error = cats.errors[i];
                  return (
                    <div key={i} data-last={i === rows.length - 1 ? "" : undefined}>
                      <div className="wt-cat-row">
                        <span className={`wt-dot${used ? "" : " is-empty"}`} title={COLOR_NAMES[color - 1]} style={{ "--dot": `var(--cat-${color}-solid)` } as React.CSSProperties} />
                        <input className="wt-input wt-code" aria-label="Code" placeholder="PSP-…" value={r.code} onChange={(e) => setRow(i, { code: e.target.value })} onKeyDown={enterAdds(i)} aria-invalid={!!error} />
                        <input className="wt-input" aria-label="Name" placeholder="Name" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} onKeyDown={enterAdds(i)} />
                        {rows.length > 1 ? (
                          <button type="button" className="wt-icon-btn" aria-label={`Remove ${r.code.trim() || "row"}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                          </button>
                        ) : (
                          <span className="wt-icon-btn" />
                        )}
                      </div>
                      <p className="wt-error">{error}</p>
                    </div>
                  );
                })}
              </div>
              <span className="wt-hint">Enter adds the next row. Each Category gets the next free color.</span>
            </Step>

          <Step n={4} title="How often should I ask?">
              <ChipGroup label="Interval" options={INTERVALS} value={interval} onChange={setIntervalMinutes} suffix=" min" />
              <label className="wt-check">
                <input type="checkbox" checked={autostart} onChange={(e) => setAutostart(e.target.checked)} />
                Open Hoot when I log in
              </label>
            </Step>

          <div className="wt-ob-foot">
            {message ? (
              <span className="wt-error">{message}</span>
            ) : (
              <span className="wt-hint">{firstCheckIn && `First check-in today at ${firstCheckIn}. `}Everything stays on this computer.</span>
            )}
            <button type="submit" className="wt-chip is-primary wt-start" disabled={!!problem}>Start tracking</button>
          </div>
        </form>
      </div>
    </main>
  );
}
