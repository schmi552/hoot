import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Temporal } from "temporal-polyfill";
import { MeetingOccurrence, MeetingSeries, Repeat, repeatText, REPEATS, ruleFor } from "./schedule/meetings";
import { Category, CategoryCombo } from "./CategoryCombo";
import { ErrorLine } from "./Popup";
import type { Settings } from "./Settings";

export type MeetingForm = { title: string; categoryId: number; source: string; start: string; duration: number; repeat: Repeat; editing?: MeetingOccurrence };
/** What the dialog does: show a form (new or edit), or ask about a delete. */
export type MeetingAsk = { form: MeetingForm } | { remove: MeetingOccurrence };
/** What the scope dialog is asking about: the changed form of a Meeting, or a delete. */
type Scope = { occurrence: MeetingOccurrence; form?: MeetingForm };

/** An instant as "YYYY-MM-DDTHH:MM" on the wall clock of `tz`. */
export const localInput = (tz: string, sec: number) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(sec * 1000).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

/**
 * The Meeting form and the "This Meeting only / All Meetings" question. The calendar and Settings both use it.
 * With `wholeSeries` every change and delete is for the series, so the scope question is skipped and the form has a "Delete series" button.
 */
export function MeetingDialog({ settings, categories, series, ask, wholeSeries, onClose, onDone }: {
  settings: Settings; categories: Category[]; series: MeetingSeries[]; ask: MeetingAsk; wholeSeries?: boolean; onClose: () => void; onDone: () => void;
}) {
  const [form, setForm] = useState<MeetingForm | null>("form" in ask ? ask.form : null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [error, setError] = useState(!("form" in ask) || ask.form.editing || categories.length ? "" : "Add a Category in Settings first.");
  const [failed, setFailed] = useState(false); // the last write failed, so the error line offers a retry

  const write = (p: Promise<unknown>) => p.then(onDone, (e) => (setError(String(e)), setFailed(true)));
  /** Change or delete one occurrence ("This Meeting only") or the series ("All Meetings"). */
  const change = (s: Scope, only: boolean) => {
    const { occurrence: o, form: f } = s;
    const base = series.find((x) => x.id === o.seriesId)!;
    if (!f) return write(only ? invoke("set_meeting_exception", { exception: { seriesId: o.seriesId, originalStartLocal: o.originalStartLocal, kind: "skip", startLocal: null, durationMinutes: null, title: null, categoryId: null } }) : invoke("delete_meeting", { id: o.seriesId }));
    if (only) return write(invoke("set_meeting_exception", { exception: { seriesId: o.seriesId, originalStartLocal: o.originalStartLocal, kind: "override", startLocal: f.start, durationMinutes: f.duration, title: f.title.trim(), categoryId: f.categoryId } }));
    // "All Meetings": the series start moves by as much as the user moved the occurrence in the form.
    const moved = Temporal.PlainDateTime.from(base.startLocal).add(Temporal.PlainDateTime.from(localInput(settings.tz, o.startUtc)).until(Temporal.PlainDateTime.from(f.start)));
    return write(invoke("update_meeting", { meeting: { ...base, categoryId: f.categoryId || null, title: f.title.trim(), startLocal: moved.toString({ smallestUnit: "minute" }), durationMinutes: f.duration } }));
  };
  /** A one-off Meeting (or any Meeting in `wholeSeries` mode) has no scope to ask about. */
  const askScope = (s: Scope) => (!wholeSeries && series.find((x) => x.id === s.occurrence.seriesId)?.rrule ? setScope(s) : void change(s, false));
  const save = () => {
    const f = form!;
    if (!f.title.trim() || !f.start || f.duration < 1) return setError("Give the Meeting a title, a start and a length."), setFailed(false);
    if (f.editing) return askScope({ occurrence: f.editing, form: f });
    write(invoke("create_meeting", { meeting: { id: 0, categoryId: f.categoryId || null, title: f.title.trim(), startLocal: f.start, durationMinutes: f.duration, tz: settings.tz, rrule: ruleFor(f.repeat), sourceFile: null } }));
  };
  useEffect(() => {
    if ("remove" in ask) askScope({ occurrence: ask.remove });
  }, []);

  if (scope) {
    // The title names the verb: a form with a new start is a move.
    const verb = !scope.form ? "Delete" : scope.form.start === localInput(settings.tz, scope.occurrence.startUtc) ? "Edit" : "Move";
    const title = `${verb} Meeting`;
    return (
      <div className="wt-modal">
        <form
          className="wt-form wt-editor"
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
          onKeyDown={(e) => {
            const k = e.key.toLowerCase();
            if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
            if (k === "escape") onClose();
            else if (k === "a" || k === "t") change(scope, k === "t");
          }}
          onSubmit={(e) => e.preventDefault()}
        >
          <strong>{title}</strong>
          <button className="wt-chip is-primary" type="button" autoFocus onClick={() => change(scope, true)}>This Meeting only (T)</button>
          <button className="wt-chip" type="button" onClick={() => change(scope, false)}>All Meetings (A)</button>
          <button className="wt-chip" type="button" onClick={onClose}>Cancel (Esc)</button>
          <ErrorLine error={error} />
        </form>
      </div>
    );
  }
  if (!form) return null;
  const rule = form.editing && series.find((x) => x.id === form.editing!.seriesId)?.rrule;
  return (
    <form
      className="wt-form wt-editor"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input className="wt-input" aria-label="Title" placeholder="Title" autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <div style={{ flex: 1 }}><CategoryCombo none options={categories} value={form.categoryId} onChange={(categoryId) => setForm({ ...form, categoryId })} /></div>
      {form.source && <p className="wt-sub">{form.source}</p>}
      {rule && <p className="wt-sub">{repeatText(rule)}</p>}
      <input className="wt-input" type="datetime-local" aria-label="Start" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
      <input className="wt-input" type="number" min={5} step={5} aria-label="Duration in minutes" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
      {!form.editing && (
        <select className="wt-input" aria-label="Repeat" value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value as Repeat })}>
          {REPEATS.map((r) => <option key={r} value={r}>{r === "none" ? "Does not repeat" : r[0].toUpperCase() + r.slice(1)}</option>)}
        </select>
      )}
      <button className="wt-chip" type="button" onClick={onClose}>Cancel</button>
      <button className="wt-chip is-primary" type="submit">Save</button>
      {wholeSeries && form.editing && <button className="wt-chip" type="button" onClick={() => change({ occurrence: form.editing! }, false)}>Delete series</button>}
      <ErrorLine error={error} retry={failed ? save : undefined} />
    </form>
  );
}
