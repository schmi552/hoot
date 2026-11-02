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
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Temporal } from "temporal-polyfill";
import {
  dateKey, dayBoundsIn, expectedOn, formatHM, instantAt, isWorkday, loggedMinutes, nextCheckIn, nextFreeSlot, nextFreeStart, overlapsAny, parseHM, popupSpans, resizedEnd, settingsOn, SettingsRow, Span, STEP, weekday, Ymd, ymdIn,
} from "./schedule/schedule";
import { Absence, ABSENCE_KINDS, AbsenceKind, absenceSpans, absenceTitle } from "./schedule/absences";
import { barSegments, DayTotal, daysIn, entryText, gridRange, hiddenDays, rowTotals, shortDay, showsDayTotal, weekShares } from "./schedule/week";
import { expandMeetings, MeetingException, MeetingOccurrence, MeetingSeries, sourceText } from "./schedule/meetings";
import { monthTitle, toolbarKey, weekTitle } from "./schedule/toolbar";
import { CategoryCombo } from "./CategoryCombo";
import { ExportDialog } from "./Export";
import { ImportDialog, PickCategoryDialog } from "./Import";
import { localInput, MeetingAsk, MeetingDialog } from "./MeetingDialog";
import { Hoot } from "./Hoot";
import { ErrorLine } from "./Popup";
import type { Settings } from "./Settings";

type Entry = Span & { id: number; categoryId: number; description: string; tz: string };
type Category = { id: number; code: string; name: string; color: number };
type Slot = { start: Date; end: Date };
/** One step of the history: `from` becomes `to`. A null side is an Entry that does not exist. */
type Change = { from: Entry | null; to: Entry | null };

const DEFAULT_MINUTES = 60;
const SLOT_MINUTES = 30;
const DAY = 86_400; // shortcut: a day step is 24 hours, so it is an hour off across a DST change; upgrade with instantAt if that matters
const secs = (d: Date) => d.getTime() / 1000;
/** The Absence dialog. A full-day Absence uses `from` and `to` as dates; a part-day Absence uses them as "YYYY-MM-DDTHH:MM". */
type AbsenceForm = { kind: AbsenceKind; label: string; allDay: boolean; from: string; to: string };

/** The week view. A drag on the grid, or `N`, opens the editor for a new Entry. */
/** The nearest ancestor that scrolls up and down. */
const scrollerOf = (e: Element | null | undefined) => {
  while (e && !/auto|scroll/.test(getComputedStyle(e).overflowY)) e = e.parentElement;
  return e as HTMLElement | null;
};

export function Calendar({ settings, onSettings, onDebugStartup, onDebugOnboarding }: { settings: Settings; onSettings: () => void; onDebugStartup: () => void; onDebugOnboarding: () => void }) {
  const calendar = useRef<CalendarRef>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [isWeek, setIsWeek] = useState(true);
  const [monthStart, setMonthStart] = useState(0); // the first day of the shown month, for the title
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
  const [meeting, setMeeting] = useState<MeetingAsk | null>(null);
  const [exceptions, setExceptions] = useState<MeetingException[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [absenceForm, setAbsenceForm] = useState<AbsenceForm | null>(null);
  const [pickedAbsence, setPickedAbsence] = useState<Absence | null>(null);
  const [menu, setMenu] = useState(false);
  const [jump, setJump] = useState(false); // the date picker under the title
  const [more, setMore] = useState(false); // the "..." menu: Export, Settings, Quit
  const [pickedMeeting, setPickedMeeting] = useState<MeetingOccurrence | null>(null); // a clicked Meeting; Ctrl+C copies it as an Entry
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uncategorized, setUncategorized] = useState<number[]>([]); // series of the last import that have no Category; the notice offers "Pick Category"
  const [picking, setPicking] = useState(false);
  const [locMenu, setLocMenu] = useState(""); // the date key of the day whose location menu is open
  const [dismissed, setDismissed] = useState<Record<string, number>>({}); // date key -> minutes logged when the short-day notice was dismissed; lost on quit
  const [showMascot, setShowMascot] = useState(true);
  const [cells, setCells] = useState<Record<string, HTMLElement>>({}); // date key -> the bottom div of a month cell, where our total and bar go
  const monthEl = useRef<HTMLDivElement>(null);
  const [weekColTop, setWeekColTop] = useState(0); // where the Week column starts, so its head lines up with the weekday row
  const history = useRef<{ stack: Change[]; at: number }>({ stack: [], at: 0 }); // lost on quit
  const clipboard = useRef<Entry | null>(null);

  const [rows, setRows] = useState<SettingsRow<Settings>[]>([]); // the settings history: each day uses the row that was valid on it
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
  useEffect(() => void invoke<SettingsRow<Settings>[]>("list_settings_history").then(setRows), [settings]);
  useEffect(() => void invoke<Category[]>("list_categories").then(setCategories), []);
  useEffect(() => void invoke<{ showMascot: boolean }>("get_appearance").then((a) => setShowMascot(a.showMascot)), []);
  useEffect(() => {
    if (!locMenu) return;
    const close = () => setLocMenu("");
    window.addEventListener("click", close); // the badge stops its own click, so only other clicks close the menu
    return () => window.removeEventListener("click", close);
  }, [locMenu]);
  useEffect(() => void invoke<MeetingSeries[]>("list_meetings").then(setSeries), [reload]);
  useEffect(() => void invoke<MeetingException[]>("list_meeting_exceptions").then(setExceptions), [reload]);
  useEffect(() => void invoke<Absence[]>("list_absences").then(setAbsences), [reload]);
  const meetings = range ? expandMeetings(series, exceptions, range[0], range[1]) : [];
  const away = absenceSpans(absences, settings.tz);
  const settingsAt = (d: Ymd) => (rows.length ? settingsOn(rows, d) : settings); // the settings row valid on day `d`
  // Hide the days that are no Workday and hold no item.
  const hidden = range && isWeek ? hiddenDays(settings.tz, daysIn(settings.tz, range[0], range[1]), (d) => isWorkday(settingsAt(d).workdays, d), [...entries, ...meetings, ...away]) : [];
  // A full-day Absence has its own row, so only part-day Absences widen the grid.
  const timed = [...entries, ...meetings, ...away.filter((_, i) => !absences[i].startDate)];
  const hours = gridRange(settings.workStart, settings.workEnd, settings.tz, timed);
  const clock = (sec: number) => new Intl.DateTimeFormat("en-GB", { timeZone: settings.tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(sec * 1000);
  const hourText = (h: number) => `${String(h).padStart(2, "0")}:00:00`;
  useEffect(() => {
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const open = (s: Slot, entry: Entry | null = null) => {
    setMenu(false);
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
    setMeeting({ form: { title: "", categoryId: categories[0]?.id ?? 0, source: "", start: localInput(settings.tz, start), duration: DEFAULT_MINUTES, repeat: "none" } });
  };
  const editMeeting = (m: MeetingOccurrence) => {
    setMenu(false);
    setPicked(null);
    setMeeting({ form: { title: m.title, categoryId: m.categoryId ?? 0, source: sourceText(series.find((x) => x.id === m.seriesId) ?? { sourceFile: null }), start: localInput(settings.tz, m.startUtc), duration: (m.endUtc - m.startUtc) / 60, repeat: "none", editing: m } });
  };
  const openAbsence = (from?: string, to?: string) => {
    setMenu(false);
    setPicked(null);
    const day = dateKey(ymdIn(settings.tz, Date.now() / 1000));
    setAbsenceForm({ kind: "Vacation", label: "", allDay: true, from: from ?? day, to: to ?? from ?? day });
    setError("");
    setFailed(false);
  };
  const saveAbsence = () => {
    const f = absenceForm!;
    const empty = { startDate: null, endDate: null, startUtc: null, endUtc: null, tz: null };
    const instant = (local: string) => Temporal.ZonedDateTime.from(`${local}:00[${settings.tz}]`).epochMilliseconds / 1000;
    if (!f.from || !f.to || f.to < f.from || (!f.allDay && f.to <= f.from)) return setError("Give the Absence a range that ends after it starts."), setFailed(false);
    const absence = { id: 0, kind: f.kind, label: f.label.trim(), ...empty, ...(f.allDay ? { startDate: f.from, endDate: f.to } : { startUtc: instant(f.from), endUtc: instant(f.to), tz: settings.tz }) };
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

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => (e.target as HTMLElement).closest(".wt-menu-anchor") || setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);
  useEffect(() => {
    if (!jump) return;
    const close = (e: MouseEvent) => (e.target as HTMLElement).closest(".wt-menu-anchor") || setJump(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [jump]);
  useEffect(() => {
    if (!more) return;
    const close = (e: MouseEvent) => (e.target as HTMLElement).closest(".wt-menu-anchor") || setMore(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [more]);
  const showView = (week: boolean) => {
    setMenu(false);
    setPicked(null);
    setSelected(0);
    calendar.current?.getApi().changeView(week ? "timeGridWeek" : "dayGridMonth");
  };
  const openImport = () => {
    setMenu(false);
    setImporting(true);
  };
  const onKey = useRef<(e: KeyboardEvent) => void>(undefined);
  onKey.current = (e) => {
    if (slot || meeting || absenceForm || exporting || importing || picking || e.altKey || (e.target as HTMLElement).closest("input, select, textarea")) return;
    const k = e.key.toLowerCase();
    const mod = e.metaKey || e.ctrlKey;
    const keep = () => e.preventDefault();
    if (mod && k === ",") return keep(), onSettings();
    const action = mod ? null : toolbarKey(k, menu);
    if (action === "today") return keep(), calendar.current?.getApi().today();
    if (action === "week" || action === "month") return keep(), showView(action === "week");
    if (action === "meeting") return keep(), openMeeting();
    if (action === "absence") return keep(), openAbsence();
    if (action === "import") return keep(), openImport();
    if (pickedAbsence && !mod && (k === "delete" || k === "backspace")) return keep(), void deleteAbsence(pickedAbsence);
    if (mod && k === "c" && pickedMeeting) {
      clipboard.current = { id: 0, categoryId: pickedMeeting.categoryId ?? categories[0]?.id ?? 0, description: pickedMeeting.title, startUtc: pickedMeeting.startUtc, endUtc: pickedMeeting.endUtc, tz: settings.tz };
      return;
    }
    if (pickedMeeting && !mod && (k === "delete" || k === "backspace")) return keep(), setMeeting({ remove: pickedMeeting });
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
  const expected = (d: Date) => expectedOn(settingsAt(dayOf(d)), dayOf(d), away);
  const logged = (d: Date) => loggedMinutes(entries, ...dayBoundsIn(settings.tz, dayOf(d)));
  const where = (d: Date) => ({ home: "Home", office: "Office" })[locations[dateKey(dayOf(d))]] ?? "";
  const daySub = (d: Date) => `${formatHM(logged(d))} / ${formatHM(expected(d))}${where(d) && ` · ${where(d)}`}`;
  const setLocation = (key: string, location: string) => {
    setLocMenu("");
    invoke("set_workday_location", { date: key, location }).then(load, fail);
  };
  const days = range && isWeek ? daysIn(settings.tz, range[0], range[1]) : [];
  const todayKey = dateKey(ymdIn(settings.tz, Date.now() / 1000));
  const dayTotals: DayTotal[] = days.map((day) => {
    const [from, to] = dayBoundsIn(settings.tz, day);
    return { key: dateKey(day), logged: loggedMinutes(entries, from, to), expected: expectedOn(settingsAt(day), day, away), gap: popupSpans(settingsAt(day), from, to - 1, [...entries, ...meetings, ...away])[0] ?? null };
  });
  const short = dayTotals.some((d) => d.key === todayKey) ? shortDay(dayTotals, todayKey, dismissed) : null; // only the current week warns
  const shortName = short && new Date(`${short.key}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const weekTotal = entries.reduce((sum, e) => sum + (e.endUtc - e.startUtc) / 60, 0);
  const weekExpected = dayTotals.reduce((sum, d) => sum + d.expected, 0);
  // Month view: the totals of every day on the grid, in rows of seven.
  const monthDays = range && !isWeek ? daysIn(settings.tz, range[0], range[1]) : [];
  const monthStats = new Map(monthDays.map((day) => {
    const [from, to] = dayBoundsIn(settings.tz, day);
    return [dateKey(day), { logged: loggedMinutes(entries, from, to), expected: expectedOn(settingsAt(day), day, away), entries: entries.filter((e) => e.startUtc < to && e.endUtc > from) }];
  }));
  const monthRows = Array.from({ length: monthDays.length / 7 }, (_, r) => rowTotals(monthDays.slice(r * 7, r * 7 + 7).map((d) => monthStats.get(dateKey(d))!)));
  useLayoutEffect(() => {
    const scroller = scrollerOf(monthEl.current?.querySelector(".wt-month-cell"));
    if (scroller) setWeekColTop(scroller.getBoundingClientRect().top - monthEl.current!.getBoundingClientRect().top - 26); // 26 is --month-head-height
  }); // after every render: the toolbar and the grid can move without a change of ours
  const weekColRows = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // The Week column has no scroll of its own. It follows the month grid.
    const grid = scrollerOf(monthEl.current?.querySelector(".wt-month-cell"));
    if (!grid || !weekColRows.current) return;
    const sync = () => (weekColRows.current!.scrollTop = grid.scrollTop);
    grid.addEventListener("scroll", sync);
    return () => grid.removeEventListener("scroll", sync);
  });
  const shown = days.filter((d) => !hidden.includes(weekday(d)));
  const title = isWeek ? (shown.length ? weekTitle(shown[0], shown[shown.length - 1]) : "") : monthStart ? monthTitle(ymdIn(settings.tz, monthStart)) : "";
  const empty = isWeek && !!range && !entries.length;
  const next = useMemo(() => {
    const now = Date.now() / 1000;
    return empty ? nextCheckIn(settings, now, [], [...expandMeetings(series, exceptions, now, now + 8 * DAY), ...away]) : null;
  }, [empty, settings, series, exceptions, absences]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (id: number | null) => categories.find((c) => c.id === id)?.name ?? "";
  const catClass = (id: number | null) => `wt-cat-${categories.find((c) => c.id === id)?.color ?? "none"}`; // no Category, or an unknown one: gray

  return (
    <main
      className="wt-calendar"
      onDoubleClick={(e) => {
        const id = (e.target as HTMLElement).closest<HTMLElement>("[data-id]")?.dataset.id;
        const entry = entries.find((x) => x.id === Number(id));
        if (entry) edit(entry);
      }}
    >
      <header className="wt-toolbar">
        <div className="wt-toolbar-group">
          <Hoot px={3} show={showMascot} />
          <span className="wt-toolbar-name">Work Tracker</span>
          <button className="wt-icon-btn" aria-label={isWeek ? "Previous week" : "Previous month"} onClick={() => calendar.current?.getApi().prev()}><Chevron dir="left" /></button>
          <button className="wt-chip" onClick={() => calendar.current?.getApi().today()}>Today (T)</button>
          <button className="wt-icon-btn" aria-label={isWeek ? "Next week" : "Next month"} onClick={() => calendar.current?.getApi().next()}><Chevron dir="right" /></button>
          <span className="wt-menu-anchor">
            <h1 className="wt-toolbar-title"><button className="wt-title-btn" aria-haspopup="dialog" aria-expanded={jump} title="Go to a date" onClick={() => setJump(!jump)}>{title}</button></h1>
            {jump && (
              <div className="wt-popmenu" role="dialog" aria-label="Go to a date" onKeyDown={(e) => e.key === "Escape" && setJump(false)}>
                <input className="wt-input" type="date" autoFocus aria-label="Date" defaultValue={range ? dateKey(ymdIn(settings.tz, (range[0] + range[1]) / 2)) : ""} onChange={(e) => e.target.value && (calendar.current?.getApi().gotoDate(e.target.value), setJump(false))} />
              </div>
            )}
          </span>
        </div>
        <div className="wt-toolbar-group">
          <div role="group" aria-label="View" className="wt-segmented">
            <button className="wt-chip" title="Week (W)" aria-pressed={isWeek} onClick={() => showView(true)}>Week</button>
            <button className="wt-chip" title="Month (M)" aria-pressed={!isWeek} onClick={() => showView(false)}>Month</button>
          </div>
          <span className="wt-menu-anchor">
            <button className="wt-chip is-primary" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>+ New</button>
            {menu && (
              <div className="wt-popmenu wt-plus-menu" role="menu" onKeyDown={(e) => e.key === "Escape" && setMenu(false)}>
                <button className="wt-chip" role="menuitem" autoFocus onClick={() => (setMenu(false), open({ start: new Date(defaultStart() * 1000), end: new Date((defaultStart() + DEFAULT_MINUTES * 60) * 1000) }))}>Entry (N)</button>
                <button className="wt-chip" role="menuitem" onClick={openMeeting}>Meeting (M)</button>
                <button className="wt-chip" role="menuitem" onClick={() => openAbsence()}>Absence (A)</button>
                <button className="wt-chip" role="menuitem" onClick={openImport}>Import .ics … (I)</button>
              </div>
            )}
          </span>
          <span className="wt-menu-anchor">
            <button className="wt-icon-btn" aria-label="More" aria-haspopup="menu" aria-expanded={more} onClick={() => setMore(!more)}><Dots /></button>
            {more && (
              <div className="wt-popmenu wt-plus-menu wt-menulist" role="menu" onKeyDown={(e) => e.key === "Escape" && setMore(false)}>
                <button className="wt-menuitem" role="menuitem" autoFocus onClick={() => (setMore(false), setExporting(true))}>Export …</button>
                <button className="wt-menuitem" role="menuitem" onClick={() => (setMore(false), onSettings())}>Settings ({/Mac/.test(navigator.platform) ? "Cmd" : "Ctrl"}+,)</button>
                <button className="wt-menuitem is-danger" role="menuitem" onClick={() => invoke("quit")}>Quit Work Tracker</button>
              </div>
            )}
          </span>
        </div>
      </header>
      {import.meta.env.DEV && (
        <div className="wt-debug">
          <button className="wt-chip" onClick={() => emit("debug-popup")}>Debug: open popup</button>
          <button className="wt-chip" onClick={onDebugStartup}>Debug: startup screen</button>
          <button className="wt-chip" onClick={onDebugOnboarding}>Debug: onboarding</button>
        </div>
      )}
      {exporting && <ExportDialog settings={settings} onClose={() => setExporting(false)} />}
      {importing && <ImportDialog settings={settings} categories={categories} onClose={() => setImporting(false)} onDone={(ids) => (setImporting(false), setUncategorized(ids), load())} />}
      {picking && <PickCategoryDialog categories={categories} series={series.filter((m) => uncategorized.includes(m.id))} onClose={() => setPicking(false)} onDone={() => (setPicking(false), setUncategorized([]), load())} />}
      {uncategorized.length > 0 && (
        <div className="wt-notice wt-notice-row" role="status">
          <span>{uncategorized.length} imported {uncategorized.length === 1 ? "Meeting has" : "Meetings have"} no Category.</span>
          <span className="wt-menu">
            <button className="wt-chip" onClick={() => setPicking(true)}>Pick Category</button>
            <button className="wt-chip" onClick={() => setUncategorized([])}>Dismiss</button>
          </span>
        </div>
      )}
      <p className="wt-error" role="alert">{notice}</p>
      {short && (
        <div className="wt-notice is-warning wt-notice-row" role="status">
          <span>
            {shortName}: {formatHM(short.logged)} of {formatHM(short.expected)} logged.
            {short.gap && ` ${clock(short.gap.startUtc)}–${clock(short.gap.endUtc)} has no Entry.`}
          </span>
          <span className="wt-menu">
            {short.gap && <button className="wt-chip" onClick={() => open({ start: new Date(short.gap!.startUtc * 1000), end: new Date(short.gap!.endUtc * 1000) })}>Add Entry</button>}
            <button className="wt-chip" onClick={() => setDismissed({ ...dismissed, [short.key]: short.logged })}>Dismiss</button>
          </span>
        </div>
      )}
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
            {slot.start.toLocaleString("en-GB", { timeZone: settings.tz, weekday: "short", hour: "2-digit", minute: "2-digit" })} to{" "}
            {slot.end.toLocaleTimeString("en-GB", { timeZone: settings.tz, hour: "2-digit", minute: "2-digit" })}
          </span>
          <div style={{ flex: "1 1 160px" }}><CategoryCombo options={categories} value={categoryId} onChange={setCategoryId} /></div>
          <input className="wt-input" aria-label="Description" autoFocus value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="wt-chip" type="button" onClick={close}>Cancel</button>
          <button className="wt-chip is-primary" type="submit" disabled={!categoryId}>Save</button>
          <ErrorLine error={error} retry={failed ? save : undefined} />
        </form>
      )}
      {meeting && (
        <MeetingDialog
          settings={settings}
          categories={categories}
          series={series}
          ask={meeting}
          onClose={() => setMeeting(null)}
          onDone={() => (setMeeting(null), setPickedMeeting(null), load())}
        />
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
          <select className="wt-input" aria-label="Type" value={absenceForm.kind} onChange={(e) => setAbsenceForm({ ...absenceForm, kind: e.target.value as AbsenceKind })}>
            {ABSENCE_KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
          <input className="wt-input" aria-label="Label" placeholder="Label (optional)" autoFocus value={absenceForm.label} onChange={(e) => setAbsenceForm({ ...absenceForm, label: e.target.value })} />
          <label className="wt-inline-field wt-sub">
            <input type="checkbox" checked={absenceForm.allDay} onChange={(e) => setAbsenceForm({ ...absenceForm, allDay: e.target.checked, from: absenceForm.from.slice(0, 10) + (e.target.checked ? "" : "T" + settings.workStart), to: absenceForm.to.slice(0, 10) + (e.target.checked ? "" : "T" + settings.workEnd) })} /> All day
          </label>
          <label className="wt-inline-field wt-sub">From <input className="wt-input" type={absenceForm.allDay ? "date" : "datetime-local"} value={absenceForm.from} onChange={(e) => setAbsenceForm({ ...absenceForm, from: e.target.value })} /></label>
          <label className="wt-inline-field wt-sub">To <input className="wt-input" type={absenceForm.allDay ? "date" : "datetime-local"} value={absenceForm.to} onChange={(e) => setAbsenceForm({ ...absenceForm, to: e.target.value })} /></label>
          <button className="wt-chip" type="button" onClick={() => setAbsenceForm(null)}>Cancel</button>
          <button className="wt-chip is-primary" type="submit">Save</button>
          <ErrorLine error={error} retry={failed ? saveAbsence : undefined} />
        </form>
      )}
      {!isWeek && (
        <div className="wt-legend">
          {categories.map((c) => <span key={c.id} className={catClass(c.id)}><span className="wt-dot" style={{ borderRadius: "50%", width: 10, height: 10, background: "var(--cat-solid)" }} />{c.code || c.name}</span>)}
          <span>Bar = share of the day per Category. Click a day to open its week.</span>
        </div>
      )}
      <div ref={monthEl} className={isWeek ? "wt-week" : "wt-month"}>
      <div className="wt-week-grid">
      <FullCalendar
        ref={calendar}
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, classicTheme]}
        timeZone={settings.tz}
        initialView="timeGridWeek"
        hiddenDays={hidden}
        businessHours={{ daysOfWeek: [...settings.workdays].map(Number), startTime: settings.workStart, endTime: settings.workEnd }}
        slotMinTime={hourText(hours.minHour)}
        slotMaxTime={hourText(hours.maxHour)}
        slotMinHeight={32}
        slotHeaderInterval="01:00"
        slotHeaderFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        slotLaneClass={(i) => i.isMinor && "wt-slot-half"}
        headerToolbar={false}
        firstDay={1}
        nowIndicator
        height="100%"
        slotDuration={{ minutes: SLOT_MINUTES }}
        snapDuration="00:15:00"
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
          place(e, e.startUtc, secs(i.event.end!)); // an overlap is refused, like a move
        }}
        columnEventClass={(i) => {
          const entry = i.event.extendedProps.entry as Entry | undefined;
          const over = i.isMirror && entry && overlapsAny(entries, { startUtc: secs(i.event.start!), endUtc: secs(i.event.end!) }, entry.id);
          return [i.isMirror && "wt-preview", over && "is-overlap", i.isDragging && !i.isMirror && "wt-drag-source"].filter(Boolean).join(" ");
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
        datesSet={(i) => {
          const week = i.view.type === "timeGridWeek";
          setIsWeek(week);
          setMonthStart(secs(i.view.currentStart));
          setRange(week ? [secs(i.view.currentStart), secs(i.view.currentEnd)] : [secs(i.start), secs(i.end)]); // a hidden day must still load its items
        }}
        events={[
          ...(isWeek ? entries : []).map((e) => ({
            id: String(e.id),
            title: `${name(e.categoryId)}: ${e.description}`,
            start: new Date(e.startUtc * 1000),
            end: new Date(e.endUtc * 1000),
            className: `wt-entry ${catClass(e.categoryId)}${e.id === selected ? " wt-selected" : ""}`,
            extendedProps: { entry: e },
          })),
          ...(isWeek ? meetings : []).map((m) => ({
            id: `m${m.seriesId}-${m.startUtc}`,
            title: m.categoryId === null ? m.title : `${name(m.categoryId)}: ${m.title}`,
            start: new Date(m.startUtc * 1000),
            end: new Date(m.endUtc * 1000),
            editable: false,
            className: `wt-meeting ${catClass(m.categoryId)}${pickedMeeting && pickedMeeting.seriesId === m.seriesId && pickedMeeting.startUtc === m.startUtc ? " wt-selected" : ""}`,
            extendedProps: { meeting: m, repeats: !!series.find((x) => x.id === m.seriesId)?.rrule },
          })),
          ...absences.map((a) => ({
            id: `a${a.id}`,
            title: absenceTitle(a),
            ...(a.startDate ? { start: a.startDate, end: Temporal.PlainDate.from(a.endDate!).add({ days: 1 }).toString(), allDay: true } : { start: new Date(a.startUtc! * 1000), end: new Date(a.endUtc! * 1000) }),
            editable: false,
            className: `wt-absence${pickedAbsence?.id === a.id ? " wt-selected" : ""}`,
            extendedProps: { absence: a },
          })),
          // The off-hours shade is the businessHours below. Each day also gets a Lunch band, and a full-day Absence hatches its whole column.
          ...(isWeek ? days.filter((d) => isWorkday(settingsAt(d).workdays, d)).map((d) => ({
            start: new Date(instantAt(settings.tz, d, parseHM(settingsAt(d).lunchStart)) * 1000),
            end: new Date(instantAt(settings.tz, d, parseHM(settingsAt(d).lunchEnd)) * 1000),
            display: "background",
            className: "wt-lunchband",
          })) : []),
          ...(isWeek ? absences.filter((a) => a.startDate).map((a) => ({ start: a.startDate!, end: Temporal.PlainDate.from(a.endDate!).add({ days: 1 }).toString(), display: "background", className: "wt-absence-bg" })) : []),
          ...(picked ? [{ start: picked, end: new Date(picked.getTime() + SLOT_MINUTES * 60_000), display: "background" }] : []),
        ]}
        eventContent={(i) => {
          const { entry, meeting, absence, repeats } = i.event.extendedProps as { entry?: Entry; meeting?: MeetingOccurrence; absence?: Absence; repeats?: boolean };
          const [start, end] = [secs(i.event.start!), secs(i.event.end!)]; // during a drag these are the new times
          const time = `${clock(start)}–${clock(end)}`;
          if (entry) {
            const cat = categories.find((c) => c.id === entry.categoryId);
            const t = entryText((end - start) / 60, entry.description || cat?.name || "", `${cat?.code ? cat.code + " · " : ""}${time}`);
            return (
              <div className={t.compact ? "wt-entry-text is-compact" : "wt-entry-text"}>
                <b>{t.title}</b>
                {t.meta && <span>{t.meta}</span>}
                {i.isMirror && overlapsAny(entries, { startUtc: start, endUtc: end }, entry.id) && <span className="wt-overlaps">Overlaps</span>}
                {entry.id === selected && <span className="wt-grip" />}
              </div>
            );
          }
          if (meeting) {
            return (
              <div className="wt-meeting-text">
                <b>{meeting.title}</b>
                {repeats && (
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Repeats">
                    <path d="M2.5 7a5.5 5.5 0 0 1 9.6-3.2L13.5 5M13.5 2v3h-3M13.5 9a5.5 5.5 0 0 1-9.6 3.2L2.5 11M2.5 14v-3h3" />
                  </svg>
                )}
              </div>
            );
          }
          return <span className="wt-absence-label"><b>{absenceTitle(absence!)}</b>{!i.event.allDay && ` · ${time}`}</span>;
        }}
        dayHeaderContent={(i) => {
          if (i.view.type !== "timeGridWeek") return <div className="wt-dow">{i.text}</div>;
          const day = dayOf(i.date);
          const key = dateKey(day);
          const dow = new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
          return (
            <div className="wt-day-head">
              <div className="wt-day-top">
                <span className="wt-day-name">
                  {dow}
                  <span className={i.isToday ? "wt-month-num is-today" : "wt-month-num"}>{day.d}</span>
                </span>
                {isWorkday(settingsAt(day).workdays, day) && (
                  <span className="wt-menu-anchor">
                    <button className="wt-badge" aria-haspopup="menu" aria-expanded={locMenu === key} onClick={(e) => (e.stopPropagation(), setLocMenu(locMenu === key ? "" : key))}>
                      {locations[key] && <LocationIcon location={locations[key]} />}
                      {where(i.date) || "Location"}
                    </button>
                    {locMenu === key && (
                      <div className="wt-popmenu" role="menu" onKeyDown={(e) => e.key === "Escape" && setLocMenu("")}>
                        {(["home", "office"] as const).map((l) => (
                          <button key={l} role="menuitemradio" aria-checked={locations[key] === l} className="wt-chip" autoFocus={l === (locations[key] ?? "home")} onClick={() => setLocation(key, l)}>{l === "home" ? "Home" : "Office"}</button>
                        ))}
                      </div>
                    )}
                  </span>
                )}
              </div>
              <span className="wt-day-total">{logged(i.date) < expected(i.date) && <ShortIcon />}{formatHM(logged(i.date))}<span className="wt-day-exp"> / {formatHM(expected(i.date))}</span></span>
            </div>
          );
        }}
        dayCellTopContent={(i) => {
          const day = dayOf(i.date);
          const place = locations[dateKey(day)];
          return (
            <div className="wt-month-top">
              <span className={i.isToday ? "wt-month-num is-today" : i.isOther ? "wt-month-num is-other" : "wt-month-num"}>{day.d}</span>
              {place && <LocationIcon location={place} />}
            </div>
          );
        }}
        dayCellClass={(i) => (i.view.type === "dayGridMonth" ? `wt-month-cell${isWorkday(settingsAt(dayOf(i.date)).workdays, dayOf(i.date)) ? "" : " wt-month-off"}` : logged(i.date) < expected(i.date) && "wt-day-short")}
        dayCellBottomClass="wt-month-bottom"
        dayCellDidMount={(i) => {
          if (i.view.type !== "dayGridMonth") return;
          const key = dateKey(dayOf(i.date));
          setCells((c) => ({ ...c, [key]: i.el.querySelector<HTMLElement>(".wt-month-bottom")! })); // the portal target is the bottom div of the cell
        }}
        dayCellWillUnmount={(i) => setCells(({ [dateKey(dayOf(i.date))]: _, ...c }) => c)}
        dayHeaderClass={(i) => i.view.type === "timeGridWeek" && logged(i.date) < expected(i.date) && "wt-day-short"}
      />
      {empty && (
        <div className="wt-empty" aria-live="polite">
          <div className="wt-empty-panel">
            <Hoot px={5} show={showMascot} />
            <b className="wt-empty-title">Nothing logged this week</b>
            <p>Drag in the grid to add an Entry.{next ? ` The next check-in is at ${clock(next)}.` : ""}</p>
          </div>
        </div>
      )}
      </div>
      {!isWeek && (
        <div className="wt-weekcol" aria-label="Week totals" style={{ marginTop: weekColTop }}>
          <div className="wt-weekcol-head">Week</div>
          <div ref={weekColRows} className="wt-weekcol-rows">
            {monthRows.map((r, n) => (
              <div key={n} className="wt-weekcol-row">
                <b>{formatHM(r.logged)}</b>
                <span>of {formatHM(r.expected)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {isWeek && (
        <aside className="wt-side" aria-label="Week summary">
          <span className="wt-sub">This week</span>
          <b className="wt-total">{formatHM(weekTotal)}</b>
          <span className="wt-sub">of {formatHM(weekExpected)} expected</span>
          {weekShares(entries).map((s) => (
            <div key={s.categoryId} className={`wt-share ${catClass(s.categoryId)}`}>
              <span className="wt-share-row"><span className="wt-dot" /><span>{name(s.categoryId)}</span><span className="wt-sub">{formatHM(s.minutes)}</span></span>
              <span className="wt-bar"><span style={{ width: `${(s.minutes / weekTotal) * 100}%` }} /></span>
            </div>
          ))}
          {selected > 0 && (
            <div className="wt-side-keys">
              <b>Selected Entry</b>
              <span><kbd className="wt-kbd">↑</kbd><kbd className="wt-kbd">↓</kbd>move 15 min</span>
              <span><kbd className="wt-kbd">Shift</kbd><kbd className="wt-kbd">↑</kbd><kbd className="wt-kbd">↓</kbd>resize</span>
              <span><kbd className="wt-kbd">Ctrl</kbd><kbd className="wt-kbd">D</kbd>duplicate</span>
              <span><kbd className="wt-kbd">Ctrl</kbd><kbd className="wt-kbd">C</kbd><kbd className="wt-kbd">V</kbd>copy, paste</span>
              <span><kbd className="wt-kbd">Del</kbd>delete · <kbd className="wt-kbd">Ctrl</kbd><kbd className="wt-kbd">Z</kbd>undo</span>
            </div>
          )}
          {pickedMeeting && (
            <div className="wt-side-keys">
              <b>Selected Meeting</b>
              <span><kbd className="wt-kbd">Enter</kbd>edit · <kbd className="wt-kbd">Del</kbd>delete</span>
              <span><kbd className="wt-kbd">Ctrl</kbd><kbd className="wt-kbd">C</kbd>copy as Entry</span>
              <span className="wt-menu">
                <button className="wt-chip" onClick={() => editMeeting(pickedMeeting)}>Edit Meeting</button>
                <button className="wt-chip" onClick={() => setMeeting({ remove: pickedMeeting })}>Delete Meeting</button>
              </span>
            </div>
          )}
          {pickedAbsence && (
            <div className="wt-side-keys">
              <b>Selected Absence</b>
              <span><kbd className="wt-kbd">Del</kbd>delete</span>
              <span className="wt-menu"><button className="wt-chip" onClick={() => deleteAbsence(pickedAbsence)}>Delete Absence</button></span>
            </div>
          )}
        </aside>
      )}
      </div>
      {Object.entries(cells).map(([key, el]) => {
        const stat = monthStats.get(key);
        if (!stat || isWeek || !showsDayTotal(stat, key > todayKey)) return null;
        const short = key <= todayKey && stat.logged < stat.expected;
        return createPortal(
          <div className="wt-month-total">
            <span className={short ? "is-short" : undefined}>{short && <ShortIcon />}{formatHM(stat.logged)}</span>
            <span className="wt-month-bar">{barSegments(stat.entries).map((s) => <span key={s.categoryId} className={catClass(s.categoryId)} style={{ width: `${s.percent}%` }} />)}</span>
          </div>,
          el,
          key,
        );
      })}
    </main>
  );
}

const icon = { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", role: "img" } as const;

/** The read-only location mark in a month cell. */
function LocationIcon({ location }: { location: string }) {
  const home = location === "home";
  return (
    <span className="wt-month-loc" title={home ? "Home" : "Office"}>
      <svg {...icon} aria-label={home ? "Home" : "Office"}>
        {home ? <><path d="M2.5 7.5 8 3l5.5 4.5" /><path d="M4 6.5V13h8V6.5" /><path d="M6.5 13V9.5h3V13" /></> : <><rect x="3.5" y="2.5" width="9" height="11" rx="1" /><path d="M6 5.5h1M9 5.5h1M6 8h1M9 8h1M7 13.5V11h2v2.5" /></>}
      </svg>
    </span>
  );
}

function ShortIcon() {
  return <svg {...icon} width={12} height={12} aria-label="Short day"><path d="M8 2.5 14 13H2z" /><path d="M8 6.5v3" /><path d="M8 11.2v.1" /></svg>;
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "left" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"} />
    </svg>
  );
}

function Dots() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

