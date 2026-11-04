import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";

/** Monday to Sunday, as the weekday digit and the label. */
export const DAYS: [string, string][] = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]];

/** Turns the Workday `digit` on or off in `value`. The result stays in week order. */
export const toggleDay = (value: string, digit: string) =>
  DAYS.map(([d]) => d).filter((d) => (d === digit ? !value.includes(d) : value.includes(d))).join("");

const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

/** Reads "H:MM", "HH:MM", "HMM" or "HHMM" into "HH:MM". Returns "" if the text is not a time of day. */
export function parseTime(text: string): string {
  const m = /^(\d{1,2}):?(\d\d)$/.exec(text.trim());
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** Reads "30" or "30 min" into "30 min". Returns "" if the text is not a whole number of minutes, at least 1. */
export function parseMinutes(text: string): string {
  const m = /^(\d+)\s*(?:min)?$/.exec(text.trim());
  return m && Number(m[1]) > 0 ? `${Number(m[1])} min` : "";
}

/** A text box with a clock-less dropdown of `options`. The user can pick one or type. `parse` turns the text into a value, "" if it does not fit. */
function PickerBox({ id, label, value, options: given, parse, onChange, invalid, icon }: { id?: string; label?: string; value: string; options: string[]; parse: (text: string) => string; onChange: (v: string) => void; invalid?: boolean; icon?: boolean }) {
  const auto = useId();
  const box = id ?? auto;
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => setText(value), [value]);
  // The list has the value too, so a value that is not one of the options shows and stays chosen.
  const options = given.includes(value) || !parse(value) ? given : [...given, value].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  useEffect(() => {
    if (open) list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
  const show = () => {
    setActive(Math.max(options.indexOf(value), 0));
    setOpen(true);
  };
  const pick = (t: string) => {
    onChange(t);
    setText(t);
    setOpen(false);
  };
  const commit = () => {
    const t = parse(text);
    if (t) onChange(t);
    else setText(value);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) show();
      else setActive((a) => Math.min(Math.max(a + (e.key === "ArrowDown" ? 1 : -1), 0), options.length - 1));
    } else if (e.key === "Enter") {
      if (open) { e.preventDefault(); pick(options[active]); }
      else if (parse(text)) pick(parse(text));
    } else if (open && e.key === "Escape") { e.stopPropagation(); setOpen(false); setText(value); }
  };
  return (
    <div className="wt-combo wt-combo-down">
      <input id={box} className="wt-input wt-time" role="combobox" aria-label={label} aria-expanded={open} aria-controls={`${box}-list`} aria-autocomplete="none" autoComplete="off" inputMode="numeric"
        value={text} onChange={(e) => setText(e.target.value)} onFocus={show} onClick={show} onKeyDown={onKeyDown}
        onBlur={() => { setOpen(false); commit(); }} aria-invalid={invalid || !parse(text)} />
      {icon && <svg className="wt-time-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></svg>}
      {open && (
        <ul id={`${box}-list`} ref={list} role="listbox" aria-label={label}>
          {options.map((t, i) => (
            <li key={t} role="option" aria-selected={i === active} className={`wt-mono${i === active ? " is-active" : ""}`} onMouseDown={(e) => { e.preventDefault(); pick(t); }}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A "HH:MM" picker with a label above it. Its list shows a time every 15 min. The user can also type a time. `invalid` sets the error style. Onboarding and Settings share it. */
export function TimeField({ label, value, onChange, invalid }: { label: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const id = useId();
  return (
    <div className="wt-field">
      <label className="wt-label" htmlFor={id}>{label}</label>
      <PickerBox id={id} value={value} options={TIMES} parse={parseTime} onChange={onChange} invalid={invalid} icon />
    </div>
  );
}

/** A "N min" picker with a label above it. `value` is in minutes. The list shows `options`. The user can also type any whole number. */
export function MinutesField({ label, value, options, onChange, invalid }: { label: string; value: number; options: number[]; onChange: (v: number) => void; invalid?: boolean }) {
  const id = useId();
  return (
    <div className="wt-field">
      <label className="wt-label" htmlFor={id}>{label}</label>
      <PickerBox id={id} value={`${value} min`} options={options.map((o) => `${o} min`)} parse={parseMinutes} onChange={(t) => onChange(parseInt(t))} invalid={invalid} />
    </div>
  );
}

/** Two pickers under one label: a start time and a length in minutes. */
export function TimeSpanField({ label, time, minutes, minuteOptions, onTime, onMinutes, invalid }: { label: string; time: string; minutes: number; minuteOptions: number[]; onTime: (v: string) => void; onMinutes: (v: number) => void; invalid?: boolean }) {
  return (
    <div className="wt-field" role="group" aria-label={label}>
      <span className="wt-label">{label}</span>
      <div className="wt-span">
        <PickerBox label={`${label} starts at`} value={time} options={TIMES} parse={parseTime} onChange={onTime} invalid={invalid} icon />
        <PickerBox label={`${label} length`} value={`${minutes} min`} options={minuteOptions.map((o) => `${o} min`)} parse={parseMinutes} onChange={(t) => onMinutes(parseInt(t))} invalid={invalid} />
      </div>
    </div>
  );
}

/** One chip is on at a time. `suffix` follows each value, as in "30 min". */
export function ChipGroup({ label, options, value, onChange, suffix = "" }: { label: string; options: number[]; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div role="group" aria-label={label} className="wt-chips">
      {options.map((o) => (
        <button key={o} type="button" className="wt-chip" aria-pressed={o === value} onClick={() => onChange(o)}>{o}{suffix}</button>
      ))}
    </div>
  );
}

/** Mon to Sun chips. `value` and the result are weekday digits in week order, as in `Settings.workdays`. */
export function DayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div role="group" aria-label="Workdays" className="wt-chips">
      {DAYS.map(([digit, label]) => (
        <button
          key={digit}
          type="button"
          className="wt-chip wt-day-chip"
          aria-pressed={value.includes(digit)}
          onClick={() => onChange(toggleDay(value, digit))}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
