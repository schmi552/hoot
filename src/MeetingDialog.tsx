import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Temporal } from "temporal-polyfill";
import { MeetingOccurrence, MeetingSeries, Repeat, repeatText, REPEATS, ruleFor, WEEKDAYS } from "./schedule/meetings";
import { Category, CategoryCombo } from "./CategoryCombo";
import { Field, FormDialog } from "./FormDialog";
import { ErrorLine } from "./Popup";
import type { Settings } from "./Settings";

export type MeetingForm = { title: string; categoryId: number; source: string; start: string; duration: number; repeat: Repeat; days?: string[]; editing?: MeetingOccurrence };
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
export function MeetingDialog({ settings, categories, series, ask, wholeSeries, onClose, onDone, onAbsence }: {
  settings: Settings; categories: Category[]; series: MeetingSeries[]; ask: MeetingAsk; wholeSeries?: boolean; onClose: () => void; onDone: () => void;
  /** Given for a new Meeting: the header then offers a switch to the Absence form. */
  onAbsence?: () => void;
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
    if (f.repeat === "custom" && !f.days?.length) return setError("Pick at least one day for the repeat."), setFailed(false);
    if (f.editing) return askScope({ occurrence: f.editing, form: f });
    write(invoke("create_meeting", { meeting: { id: 0, categoryId: f.categoryId || null, title: f.title.trim(), startLocal: f.start, durationMinutes: f.duration, tz: settings.tz, rrule: ruleFor(f.repeat, f.days), sourceFile: null } }));
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
  /** "On certain weekdays" starts with the weekday of the start, so the first Meeting is one of the days. */
  const pickRepeat = (repeat: Repeat) => setForm({ ...form, repeat, days: form.days?.length ? form.days : [WEEKDAYS[Temporal.PlainDateTime.from(form.start || localInput(settings.tz, Date.now() / 1000)).dayOfWeek - 1]] });
  const rule = form.editing && series.find((x) => x.id === form.editing!.seriesId)?.rrule;
  return (
    <FormDialog
      title={form.editing ? "Edit Meeting" : onAbsence ? "New Event" : "New Meeting"}
      kind={onAbsence && !form.editing ? "Meeting" : undefined}
      onKind={onAbsence}
      onClose={onClose}
      onSubmit={save}
      error={error}
      retry={failed ? save : undefined}
      extra={wholeSeries && form.editing && <button className="wt-chip" type="button" onClick={() => change({ occurrence: form.editing! }, false)}>Delete series</button>}
    >
      <Field label="Title"><input className="wt-input" autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
      <div className="wt-field"><span className="wt-label">Category</span><CategoryCombo none down options={categories} value={form.categoryId} onChange={(categoryId) => setForm({ ...form, categoryId })} /></div>
      {form.source && <p className="wt-sub">{form.source}</p>}
      {rule && <p className="wt-sub">{repeatText(rule)}</p>}
      <div className="wt-dialog-row">
        <Field label="Start"><input className="wt-input" type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
        <Field label="Length (min)"><input className="wt-input" type="number" min={5} step={5} value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} /></Field>
      </div>
      {!form.editing && (
        <>
          <Field label="Repeat">
            <select className="wt-input" value={form.repeat} onChange={(e) => pickRepeat(e.target.value as Repeat)}>
              {REPEATS.map((r) => <option key={r} value={r}>{r === "none" ? "Does not repeat" : r === "custom" ? "On certain weekdays" : r[0].toUpperCase() + r.slice(1)}</option>)}
            </select>
          </Field>
          {form.repeat === "custom" && (
            <div className="wt-field">
              <span className="wt-label">Every week on</span>
              <div role="group" aria-label="Days" className="wt-days">
                {WEEKDAYS.map((d, i) => (
                  <button key={d} type="button" className="wt-chip" aria-pressed={!!form.days?.includes(d)} onClick={() => setForm({ ...form, days: form.days?.includes(d) ? form.days.filter((x) => x !== d) : [...(form.days ?? []), d] })}>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </FormDialog>
  );
}
