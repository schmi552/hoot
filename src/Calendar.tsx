import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import FullCalendar, { CalendarRef } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import classicTheme from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
import { useEffect, useRef, useState } from "react";
import { Temporal } from "temporal-polyfill";
import {
  dateKey, dayBoundsIn, expectedOn, formatHM, instantAt, loggedMinutes, nextFreeSlot, nextFreeStart, overlapsAny, parseHM, resizedEnd, Span, STEP, ymdIn,
} from "./schedule/schedule";
import { Absence, absenceSpans } from "./schedule/absences";
import { expandMeetings, MeetingException, MeetingOccurrence, MeetingSeries, Repeat, REPEATS, ruleFor } from "./schedule/meetings";
import { ExportDialog } from "./Export";
import { ErrorLine } from "./Popup";
import type { Settings } from "./Settings";

type Entry = Span & { id: number; categoryId: number; description: string; tz: string };
type Category = { id: number; name: string };
type Slot = { start: Date; end: Date };
/** One step of the history: `from` becomes `to`. A null side is an Entry that does not exist. */
type Change = { from: Entry | null; to: Entry | null };

const DEFAULT_MINUTES = 60;
const SLOT_MINUTES = 30;
const DAY = 86_400; // shortcut: a day step is 24 hours, so it is an hour off across a DST change; upgrade with instantAt if that matters
const secs = (d: Date) => d.getTime() / 1000;
/** An instant as "YYYY-MM-DDTHH:MM" on the wall clock of `tz`. */
const localInput = (tz: string, sec: number) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(sec * 1000).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
type MeetingForm = { title: string; categoryId: number; start: string; duration: number; repeat: Repeat; editing?: MeetingOccurrence };
/** The Absence dialog. A full-day Absence uses `from` and `to` as dates; a part-day Absence uses them as "YYYY-MM-DDTHH:MM". */
type AbsenceForm = { label: string; allDay: boolean; from: string; to: string };
/** What the scope dialog is asking about: the changed form of a Meeting, or a delete. */
type Scope = { occurrence: MeetingOccurrence; form?: MeetingForm };

/** The week view. A drag on the grid, or `N`, opens the editor for a new Entry. */
export function Calendar({ settings, onSettings }: { settings: Settings; onSettings: () => void }) {
  const calendar = useRef<CalendarRef>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Record<string, string>>({}); // date -> "home" | "office"
  const [slot, setSlot] = useState<Slot | null>(null);
  const [picked, setPicked] = useState<Date | null>(null); // a clicked slot, shaded until `N` or a drag uses it
  const [categoryId, setCategoryId] = useState(0);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false); // the last editor write failed, so the error line offers a retry
  const [editing, setEditing] = useState<Entry | null>(null);
  const [selected, setSelected] = useState(0);
  const [notice, setNotice] = useState("");
  const [series, setSeries] = useState<MeetingSeries[]>([]);
  const [meetingForm, setMeetingForm] = useState<MeetingForm | null>(null);
  const [exceptions, setExceptions] = useState<MeetingException[]>([]);
  const [scope, setScope] = useState<Scope | null>(null);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [absenceForm, setAbsenceForm] = useState<AbsenceForm | null>(null);
  const [pickedAbsence, setPickedAbsence] = useState<Absence | null>(null);
  const [menu, setMenu] = useState(false);
  const [pickedMeeting, setPickedMeeting] = useState<MeetingOccurrence | null>(null); // a clicked Meeting; Ctrl+C copies it as an Entry
  const [exporting, setExporting] = useState(false);
  const history = useRef<{ stack: Change[]; at: number }>({ stack: [], at: 0 }); // lost on quit
  const clipboard = useRef<Entry | null>(null);

  const [reload, setReload] = useState(0);
  const load = () => setReload((n) => n + 1);
  useEffect(() => {
    if (!range) return;
    let stale = false; // a slower answer for an earlier week must not replace the current one
    invoke<Entry[]>("list_entries", { fromUtc: range[0], toUtc: range[1] }).then((e) => stale || setEntries(e));
    return () => void (stale = true);
  }, [range, reload]);
  useEffect(() => {
    const unlisten = listen("entries-changed", load); // the popup saved an Entry
    return () => void unlisten.then((f) => f());
  }, []);
  useEffect(() => {
    if (!range) return;
    let stale = false;
    const [from, to] = [dateKey(ymdIn(settings.tz, range[0])), dateKey(ymdIn(settings.tz, range[1] - 1))];
    invoke<{ date: string; location: string }[]>("list_workday_locations", { from, to }).then((l) => stale || setLocations(Object.fromEntries(l.map((x) => [x.date, x.location]))));
    return () => void (stale = true);
  }, [range, reload]);
  useEffect(() => void invoke<Category[]>("list_categories").then(setCategories), []);
  useEffect(() => void invoke<MeetingSeries[]>("list_meetings").then(setSeries), [reload]);
  useEffect(() => void invoke<MeetingException[]>("list_meeting_exceptions").then(setExceptions), [reload]);
  useEffect(() => void invoke<Absence[]>("list_absences").then(setAbsences), [reload]);
  const meetings = range ? expandMeetings(series, exceptions, range[0], range[1]) : [];
  useEffect(() => {
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const open = (s: Slot, entry: Entry | null = null) => {
    setSlot(s);
    setEditing(entry);
    setPicked(null);
    setCategoryId(entry?.categoryId ?? categories[0]?.id ?? 0);
    setDescription(entry?.description ?? "");
    setError(categories.length ? "" : "Add a Category in Settings first.");
    setFailed(false);
  };
  const openMeeting = () => {
    setMenu(false);
    setPicked(null);
    const start = picked ? secs(picked) : defaultStart();
    setMeetingForm({ title: "", categoryId: categories[0]?.id ?? 0, start: localInput(settings.tz, start), duration: DEFAULT_MINUTES, repeat: "none" });
    setError(categories.length ? "" : "Add a Category in Settings first.");
    setFailed(false);
  };
  const editMeeting = (m: MeetingOccurrence) => {
    setMenu(false);
    setPicked(null);
    setMeetingForm({ title: m.title, categoryId: m.categoryId, start: localInput(settings.tz, m.startUtc), duration: (m.endUtc - m.startUtc) / 60, repeat: "none", editing: m });
    setError("");
    setFailed(false);
  };
  /** Run a Meeting write; on success close the dialogs, on failure show the error where the user can retry. */
  const writeMeeting = (write: Promise<unknown>) =>
    write.then(
      () => (setMeetingForm(null), setScope(null), setPickedMeeting(null), load()),
      (e) => (setError(String(e)), setFailed(true)),
    );
  /** Change or delete one occurrence ("This Meeting only") or the series ("All Meetings"). */
  const changeMeeting = (s: Scope, only: boolean) => {
    const { occurrence: o, form: f } = s;
    const base = series.find((x) => x.id === o.seriesId)!;
    if (!f) return writeMeeting(only ? invoke("set_meeting_exception", { exception: { seriesId: o.seriesId, originalStartLocal: o.originalStartLocal, kind: "skip", startLocal: null, durationMinutes: null, title: null, categoryId: null } }) : invoke("delete_meeting", { id: o.seriesId }));
    if (only) return writeMeeting(invoke("set_meeting_exception", { exception: { seriesId: o.seriesId, originalStartLocal: o.originalStartLocal, kind: "override", startLocal: f.start, durationMinutes: f.duration, title: f.title.trim(), categoryId: f.categoryId } }));
    // "All Meetings": the series start moves by as much as the user moved the occurrence in the form.
    const moved = Temporal.PlainDateTime.from(base.startLocal).add(Temporal.PlainDateTime.from(localInput(settings.tz, o.startUtc)).until(Temporal.PlainDateTime.from(f.start)));
    return writeMeeting(invoke("update_meeting", { meeting: { ...base, categoryId: f.categoryId, title: f.title.trim(), startLocal: moved.toString({ smallestUnit: "minute" }), durationMinutes: f.duration } }));
  };
  /** A one-off Meeting has no scope to ask about. */
  const askScope = (s: Scope) => (series.find((x) => x.id === s.occurrence.seriesId)?.rrule ? setScope(s) : void changeMeeting(s, false));
  const saveMeeting = () => {
    const f = meetingForm!;
    if (!f.title.trim() || !f.start || f.duration < 1) return setError("Give the Meeting a title, a start and a length."), setFailed(false);
    if (f.editing) return askScope({ occurrence: f.editing, form: f });
    invoke("create_meeting", { meeting: { id: 0, categoryId: f.categoryId, title: f.title.trim(), startLocal: f.start, durationMinutes: f.duration, tz: settings.tz, rrule: ruleFor(f.repeat) } }).then(
      () => (setMeetingForm(null), load()),
      (e) => (setError(String(e)), setFailed(true)),
    );
  };
  const openAbsence = (from?: string, to?: string) => {
    setMenu(false);
    setPicked(null);
    const day = dateKey(ymdIn(settings.tz, Date.now() / 1000));
    setAbsenceForm({ label: "", allDay: true, from: from ?? day, to: to ?? from ?? day });
    setError("");
    setFailed(false);
  };
  const saveAbsence = () => {
    const f = absenceForm!;
    const empty = { startDate: null, endDate: null, startUtc: null, endUtc: null, tz: null };
    const instant = (local: string) => Temporal.ZonedDateTime.from(`${local}:00[${settings.tz}]`).epochMilliseconds / 1000;
    if (!f.label.trim() || !f.from || !f.to || f.to < f.from || (!f.allDay && f.to <= f.from)) return setError("Give the Absence a label and a range that ends after it starts."), setFailed(false);
    const absence = { id: 0, label: f.label.trim(), ...empty, ...(f.allDay ? { startDate: f.from, endDate: f.to } : { startUtc: instant(f.from), endUtc: instant(f.to), tz: settings.tz }) };
    invoke("create_absence", { absence }).then(
      () => (setAbsenceForm(null), load()),
      (e) => (setError(String(e)), setFailed(true)),
    );
  };
  const deleteAbsence = (a: Absence) => invoke("delete_absence", { id: a.id }).then(() => (setPickedAbsence(null), load()), fail);
  const close = () => {
    setSlot(null);
    setEditing(null);
    calendar.current?.getApi().unselect();
  };

  const apply = ({ from, to }: Change): Promise<Entry | null> =>
    to
      ? from
        ? invoke("update_entry", { entry: to }).then(() => to)
        : invoke<Entry>("create_entry", { entry: to })
      : invoke("delete_entry", { id: from!.id }).then(() => null);

  /** Make a change and put it in the history. Rejects with the message of the store. */
  const commit = (from: Entry | null, to: Entry | null) =>
    apply({ from, to }).then((done) => {
      const h = history.current;
      h.stack.splice(h.at, Infinity, { from, to: done });
      h.at++;
      load();
    });
  const fail = (e: unknown) => {
    setNotice(String(e));
    load(); // puts back what a drag moved on the grid
  };
  const act = (from: Entry | null, to: Entry | null) => commit(from, to).catch(fail);

  const travel = (dir: 1 | -1) => {
    const h = history.current;
    const c = h.stack[dir > 0 ? h.at : h.at - 1];
    if (!c) return;
    apply(dir > 0 ? c : { from: c.to, to: c.from }).then(() => {
      h.at += dir;
      load();
    }, fail);
  };

  /** Move or resize; a result that overlaps another Entry is refused. */
  const place = (e: Entry, startUtc: number, endUtc: number) => {
    if (startUtc === e.startUtc && endUtc === e.endUtc) return load();
    const to = { ...e, startUtc, endUtc };
    if (overlapsAny(entries, to, e.id)) return fail("This time already has an Entry.");
    act(e, to);
  };

  const save = () => {
    if (!slot) return;
    const entry = { ...(editing ?? { id: 0, startUtc: secs(slot.start), endUtc: secs(slot.end), tz: settings.tz }), categoryId, description: description.trim() };
    commit(editing, entry).then(close, (e) => (setError(String(e)), setFailed(true)));
  };

  // Where a new Entry goes when no slot is picked: right after the last Entry of today.
  const defaultStart = () => {
    // Today if it is on screen, else the first day on screen. Days are days in the zone of the settings.
    const nowSec = Date.now() / 1000;
    const day = ymdIn(settings.tz, range && (nowSec < range[0] || nowSec >= range[1]) ? range[0] : nowSec);
    const [from, to] = dayBoundsIn(settings.tz, day);
    return nextFreeStart(entries, from, to, instantAt(settings.tz, day, parseHM(settings.workStart)));
  };
  const edit = (e: Entry) => open({ start: new Date(e.startUtc * 1000), end: new Date(e.endUtc * 1000) }, e);

  const onKey = useRef<(e: KeyboardEvent) => void>(undefined);
  onKey.current = (e) => {
    if (slot || meetingForm || absenceForm || scope || e.altKey || (e.target as HTMLElement).closest("input, select, textarea")) return;
    const k = e.key.toLowerCase();
    const mod = e.metaKey || e.ctrlKey;
    const keep = () => e.preventDefault();
    if (k === "m" && !mod) return keep(), openMeeting();
    if (k === "a" && !mod) return keep(), openAbsence();
    if (pickedAbsence && !mod && (k === "delete" || k === "backspace")) return keep(), void deleteAbsence(pickedAbsence);
    if (mod && k === "c" && pickedMeeting) {
      clipboard.current = { id: 0, categoryId: pickedMeeting.categoryId, description: pickedMeeting.title, startUtc: pickedMeeting.startUtc, endUtc: pickedMeeting.endUtc, tz: settings.tz };
      return;
    }
    if (pickedMeeting && !mod && (k === "delete" || k === "backspace")) return keep(), askScope({ occurrence: pickedMeeting });
    if (pickedMeeting && k === "enter") return keep(), editMeeting(pickedMeeting);
    if (k === "n" && !mod) {
      keep();
      const start = picked ? secs(picked) : defaultStart();
      return open({ start: new Date(start * 1000), end: new Date((start + DEFAULT_MINUTES * 60) * 1000) });
    }
    if (mod && k === "z") return keep(), travel(e.shiftKey ? 1 : -1);
    if (mod && k === "v" && clipboard.current) {
      keep();
      const c = clipboard.current;
      const startUtc = picked ? secs(picked) : defaultStart();
      const to = { ...c, id: 0, startUtc, endUtc: startUtc + c.endUtc - c.startUtc };
      return overlapsAny(entries, to) ? fail("This time already has an Entry.") : void act(null, to);
    }
    if (k === "tab" && (selected || e.target === document.body)) {
      const i = entries.findIndex((x) => x.id === selected) + (e.shiftKey ? -1 : 1);
      const next = entries[e.shiftKey && !selected ? entries.length - 1 : i];
      setSelected(next?.id ?? 0); // past the last Entry the Tab goes on as usual
      return next && keep();
    }
    const sel = entries.find((x) => x.id === selected);
    if (!sel) return;
    const dy = k === "arrowdown" ? 1 : k === "arrowup" ? -1 : 0;
    const dx = k === "arrowright" ? 1 : k === "arrowleft" ? -1 : 0;
    if (dy || dx) {
      keep();
      if (e.shiftKey && dy) return place(sel, sel.startUtc, resizedEnd(entries, sel.id, sel.endUtc + dy * STEP));
      return place(sel, sel.startUtc + dy * STEP + dx * DAY, sel.endUtc + dy * STEP + dx * DAY);
    }
    if (mod && k === "c") clipboard.current = sel;
    else if (mod && k === "d") {
      keep();
      act(null, { ...sel, id: 0, ...nextFreeSlot(entries, sel) });
    } else if (k === "delete" || k === "backspace") {
      keep();
      setSelected(0);
      act(sel, null);
    } else if (k === "escape") setSelected(0);
    else if (k === "enter") edit(sel);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey.current?.(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // The header date is the start of the day in the zone of the settings.
  const dayOf = (d: Date) => ymdIn(settings.tz, secs(d));
  const away = absenceSpans(absences, settings.tz);
  const expected = (d: Date) => expectedOn(settings, dayOf(d), away);
  const logged = (d: Date) => loggedMinutes(entries, ...dayBoundsIn(settings.tz, dayOf(d)));
  const where = (d: Date) => ({ home: "Home", office: "Office" })[locations[dateKey(dayOf(d))]] ?? "";
  const daySub = (d: Date) => `${formatHM(logged(d))} / ${formatHM(expected(d))}${where(d) && ` · ${where(d)}`}`;
  const name = (id: number) => categories.find((c) => c.id === id)?.name ?? "";

  return (
    <main
      className="wt-calendar"
      onDoubleClick={(e) => {
        const id = (e.target as HTMLElement).closest<HTMLElement>("[data-id]")?.dataset.id;
        const entry = entries.find((x) => x.id === Number(id));
        if (entry) edit(entry);
      }}
    >
      <button className="wt-chip" onClick={onSettings}>Settings</button>
      <button className="wt-chip" onClick={() => setExporting(true)}>Export</button>
      <span className="wt-menu">
        <button className="wt-chip" aria-expanded={menu} onClick={() => setMenu(!menu)}>+</button>
        {menu && <button className="wt-chip" onClick={() => (setMenu(false), open({ start: new Date(defaultStart() * 1000), end: new Date((defaultStart() + DEFAULT_MINUTES * 60) * 1000) }))}>Entry (N)</button>}
        {menu && <button className="wt-chip" onClick={openMeeting}>Meeting (M)</button>}
        {menu && <button className="wt-chip" onClick={() => openAbsence()}>Absence (A)</button>}
      </span>
      {pickedMeeting && (
        <>
          <button className="wt-chip" onClick={() => editMeeting(pickedMeeting)}>Edit Meeting</button>
          <button className="wt-chip" onClick={() => askScope({ occurrence: pickedMeeting })}>Delete Meeting</button>
        </>
      )}
      {pickedAbsence && <button className="wt-chip" onClick={() => deleteAbsence(pickedAbsence)}>Delete Absence</button>}
      {exporting && <ExportDialog settings={settings} onClose={() => setExporting(false)} />}
      {import.meta.env.DEV && <button className="wt-chip" onClick={() => emit("debug-popup")}>Debug: open popup</button>}
      <p className="wt-error" role="alert">{notice}</p>
      {slot && (
        <form
          className="wt-form wt-editor"
          onKeyDown={(e) => e.key === "Escape" && close()}
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <span className="wt-sub">
            {slot.start.toLocaleString([], { timeZone: settings.tz, weekday: "short", hour: "2-digit", minute: "2-digit" })} to{" "}
            {slot.end.toLocaleTimeString([], { timeZone: settings.tz, hour: "2-digit", minute: "2-digit" })}
          </span>
          <select className="wt-input" aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="wt-input" aria-label="Description" autoFocus value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="wt-chip is-primary" type="submit" disabled={!categoryId}>Save</button>
          <button className="wt-chip" type="button" onClick={close}>Cancel</button>
          <ErrorLine error={error} retry={failed ? save : undefined} />
        </form>
      )}
      {meetingForm && (
        <form
          className="wt-form wt-editor"
          onKeyDown={(e) => e.key === "Escape" && setMeetingForm(null)}
          onSubmit={(e) => {
            e.preventDefault();
            saveMeeting();
          }}
        >
          <input className="wt-input" aria-label="Title" placeholder="Title" autoFocus value={meetingForm.title} onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })} />
          <select className="wt-input" aria-label="Category" value={meetingForm.categoryId} onChange={(e) => setMeetingForm({ ...meetingForm, categoryId: Number(e.target.value) })}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="wt-input" type="datetime-local" aria-label="Start" value={meetingForm.start} onChange={(e) => setMeetingForm({ ...meetingForm, start: e.target.value })} />
          <input className="wt-input" type="number" min={1} step={5} aria-label="Duration in minutes" value={meetingForm.duration} onChange={(e) => setMeetingForm({ ...meetingForm, duration: Number(e.target.value) })} />
          {!meetingForm.editing && (
            <select className="wt-input" aria-label="Repeat" value={meetingForm.repeat} onChange={(e) => setMeetingForm({ ...meetingForm, repeat: e.target.value as Repeat })}>
              {REPEATS.map((r) => <option key={r} value={r}>{r === "none" ? "Does not repeat" : r[0].toUpperCase() + r.slice(1)}</option>)}
            </select>
          )}
          <button className="wt-chip is-primary" type="submit" disabled={!meetingForm.categoryId}>Save</button>
          <button className="wt-chip" type="button" onClick={() => setMeetingForm(null)}>Cancel</button>
          <ErrorLine error={error} retry={failed ? saveMeeting : undefined} />
        </form>
      )}
      {absenceForm && (
        <form
          className="wt-form wt-editor"
          onKeyDown={(e) => e.key === "Escape" && setAbsenceForm(null)}
          onSubmit={(e) => {
            e.preventDefault();
            saveAbsence();
          }}
        >
          <input className="wt-input" aria-label="Label" placeholder="Label (Vacation, Sick)" autoFocus value={absenceForm.label} onChange={(e) => setAbsenceForm({ ...absenceForm, label: e.target.value })} />
          <label className="wt-sub">
            <input type="checkbox" checked={absenceForm.allDay} onChange={(e) => setAbsenceForm({ ...absenceForm, allDay: e.target.checked, from: absenceForm.from.slice(0, 10) + (e.target.checked ? "" : "T" + settings.workStart), to: absenceForm.to.slice(0, 10) + (e.target.checked ? "" : "T" + settings.workEnd) })} /> All day
          </label>
          <input className="wt-input" type={absenceForm.allDay ? "date" : "datetime-local"} aria-label="From" value={absenceForm.from} onChange={(e) => setAbsenceForm({ ...absenceForm, from: e.target.value })} />
          <input className="wt-input" type={absenceForm.allDay ? "date" : "datetime-local"} aria-label="To" value={absenceForm.to} onChange={(e) => setAbsenceForm({ ...absenceForm, to: e.target.value })} />
          <button className="wt-chip is-primary" type="submit">Save</button>
          <button className="wt-chip" type="button" onClick={() => setAbsenceForm(null)}>Cancel</button>
          <ErrorLine error={error} retry={failed ? saveAbsence : undefined} />
        </form>
      )}
      {scope && (
        <form className="wt-form wt-editor" role="alertdialog" aria-label="Which Meetings" onKeyDown={(e) => e.key === "Escape" && setScope(null)} onSubmit={(e) => e.preventDefault()}>
          <span className="wt-sub">{scope.form ? "Change" : "Delete"}:</span>
          <button className="wt-chip is-primary" type="button" autoFocus onClick={() => changeMeeting(scope, true)}>This Meeting only</button>
          <button className="wt-chip" type="button" onClick={() => changeMeeting(scope, false)}>All Meetings</button>
          <button className="wt-chip" type="button" onClick={() => setScope(null)}>Cancel</button>
          <ErrorLine error={error} />
        </form>
      )}
      <FullCalendar
        ref={calendar}
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, classicTheme]}
        timeZone={settings.tz}
        initialView="timeGridWeek"
        headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridWeek,dayGridMonth" }}
        firstDay={1}
        nowIndicator
        height="auto"
        slotDuration={{ minutes: SLOT_MINUTES }}
        snapDuration="00:15:00"
        scrollTime={settings.workStart + ":00"}
        selectable
        selectMirror
        selectOverlap={(ev) => !!ev.extendedProps.meeting || !!ev.extendedProps.absence} // a Meeting or an Absence never blocks an Entry
        editable
        views={{ dayGridMonth: { editable: false } }} // the month view only shows and navigates
        eventClick={(i) => {
          const m = i.event.extendedProps.meeting as MeetingOccurrence | undefined;
          const a = i.event.extendedProps.absence as Absence | undefined;
          setPickedMeeting(m ?? null);
          setPickedAbsence(a ?? null);
          setSelected(m || a ? 0 : Number(i.event.id));
        }}
        eventDidMount={(i) => void (i.el.dataset.id = i.event.id)}
        eventDrop={(i) => {
          i.revert(); // the grid follows the saved Entries, not the drag
          place(entries.find((x) => x.id === Number(i.event.id))!, secs(i.event.start!), secs(i.event.end!));
        }}
        eventResize={(i) => {
          i.revert();
          const e = entries.find((x) => x.id === Number(i.event.id))!;
          place(e, e.startUtc, resizedEnd(entries, e.id, secs(i.event.end!)));
        }}
        selectMinDistance={5}
        dateClick={(i) => {
          if (i.view.type === "dayGridMonth") return setPicked(null), setSelected(0), i.view.calendar.changeView("timeGridWeek", i.date); // the day opens in the week view
          setPicked(i.date);
          setPickedMeeting(null);
          setPickedAbsence(null);
          setSelected(0);
        }}
        select={(i) => {
          if (i.allDay && i.view.type === "timeGridWeek") {
            i.view.calendar.unselect();
            openAbsence(i.startStr.slice(0, 10), Temporal.PlainDate.from(i.endStr.slice(0, 10)).subtract({ days: 1 }).toString()); // FullCalendar's end day is not included
          } else if (i.view.type === "timeGridWeek") open({ start: i.start, end: i.end });
          else i.view.calendar.unselect(); // a drag across month cells is not an Entry
        }}
        datesSet={(i) => setRange([secs(i.start), secs(i.end)])}
        events={[
          ...entries.map((e) => ({
            id: String(e.id),
            title: `${name(e.categoryId)}: ${e.description}`,
            start: new Date(e.startUtc * 1000),
            end: new Date(e.endUtc * 1000),
            classNames: e.id === selected ? ["wt-selected"] : [],
          })),
          ...meetings.map((m) => ({
            id: `m${m.seriesId}-${m.startUtc}`,
            title: `${name(m.categoryId)}: ${m.title}`,
            start: new Date(m.startUtc * 1000),
            end: new Date(m.endUtc * 1000),
            editable: false,
            classNames: ["wt-meeting"],
            extendedProps: { meeting: m },
          })),
          ...absences.map((a) => ({
            id: `a${a.id}`,
            title: a.label,
            ...(a.startDate ? { start: a.startDate, end: Temporal.PlainDate.from(a.endDate!).add({ days: 1 }).toString(), allDay: true } : { start: new Date(a.startUtc! * 1000), end: new Date(a.endUtc! * 1000) }),
            editable: false,
            classNames: ["wt-absence"],
            extendedProps: { absence: a },
          })),
          ...(picked ? [{ start: picked, end: new Date(picked.getTime() + SLOT_MINUTES * 60_000), display: "background" }] : []),
        ]}
        dayHeaderContent={(i) => (
          <>
            <div>{i.text}</div>
            <div className="wt-sub">{daySub(i.date)}</div>
          </>
        )}
        dayCellTopContent={(i) => (
          <>
            <div>{i.text}</div>
            <div className="wt-sub">{daySub(i.date)}</div>
          </>
        )}
        dayCellClass={(i) => logged(i.date) < expected(i.date) && "wt-day-short"}
        dayHeaderClass={(i) => logged(i.date) < expected(i.date) && "wt-day-short"}
      />
    </main>
  );
}
