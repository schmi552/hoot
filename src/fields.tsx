import { useId } from "react";

/** Monday to Sunday, as the weekday digit and the label. */
export const DAYS: [string, string][] = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]];

/** Turns the Workday `digit` on or off in `value`. The result stays in week order. */
export const toggleDay = (value: string, digit: string) =>
  DAYS.map(([d]) => d).filter((d) => (d === digit ? !value.includes(d) : value.includes(d))).join("");

/** A "HH:MM" box with a label above it. `invalid` sets the error style. Onboarding and Settings share it. */
export function TimeField({ label, value, onChange, invalid }: { label: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const id = useId();
  return (
    <div className="wt-field">
      <label className="wt-label" htmlFor={id}>{label}</label>
      <input id={id} className="wt-input wt-time" type="time" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} />
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
