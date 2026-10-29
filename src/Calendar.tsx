import { invoke } from "@tauri-apps/api/core";
import FullCalendar, { CalendarRef } from "@fullcalendar/react";
import interactionPlugin from "@fullcalendar/react/interaction";
import classicTheme from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
import { useEffect, useRef, useState } from "react";
import {
  dayBoundsIn, expectedMinutes, formatHM, instantAt, loggedMinutes, nextFreeStart, parseHM, Span, weekday, ymdIn,
} from "./schedule/schedule";
import type { Settings } from "./Settings";

type Entry = Span & { id: number; categoryId: number; description: string; tz: string };
type Category = { id: number; name: string };
type Slot = { start: Date; end: Date };

const DEFAULT_MINUTES = 60;
const SLOT_MINUTES = 30;
const secs = (d: Date) => d.getTime() / 1000;

/** The week view. A drag on the grid, or `N`, opens the editor for a new Entry. */
export function Calendar({ settings, onSettings }: { settings: Settings; onSettings: () => void }) {
  const calendar = useRef<CalendarRef>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [picked, setPicked] = useState<Date | null>(null); // a clicked slot, shaded until `N` or a drag uses it
  const [categoryId, setCategoryId] = useState(0);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const [reload, setReload] = useState(0);
  const load = () => setReload((n) => n + 1);
  useEffect(() => {
    if (!range) return;
    let stale = false; // a slower answer for an earlier week must not replace the current one
    invoke<Entry[]>("list_entries", { fromUtc: range[0], toUtc: range[1] }).then((e) => stale || setEntries(e));
    return () => void (stale = true);
  }, [range, reload]);
  useEffect(() => void invoke<Category[]>("list_categories").then(setCategories), []);

  const open = (s: Slot) => {
    setSlot(s);
    setPicked(null);
    setCategoryId(categories[0]?.id ?? 0);
    setDescription("");
    setError(categories.length ? "" : "Add a Category in Settings first.");
  };
  const close = () => {
    setSlot(null);
    calendar.current?.getApi().unselect();
  };

  const save = () =>
    slot &&
    invoke("create_entry", {
      entry: { id: 0, categoryId, description: description.trim(), startUtc: secs(slot.start), endUtc: secs(slot.end), tz: settings.tz },
    }).then(() => {
      close();
      load();
    }, (e) => setError(String(e)));

  // `N`: at the selected slot, or right after the last Entry of today.
  const onKey = useRef<(e: KeyboardEvent) => void>(undefined);
  onKey.current = (e) => {
    if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || slot) return;
    if ((e.target as HTMLElement).closest("input, select, textarea")) return;
    e.preventDefault();
    if (picked) return open({ start: picked, end: new Date(picked.getTime() + DEFAULT_MINUTES * 60_000) });
    // Today if it is on screen, else the first day on screen. Days are days in the zone of the settings.
    const nowSec = Date.now() / 1000;
    const day = ymdIn(settings.tz, range && (nowSec < range[0] || nowSec >= range[1]) ? range[0] : nowSec);
    const [from, to] = dayBoundsIn(settings.tz, day);
    const fallback = instantAt(settings.tz, day, parseHM(settings.workStart));
    const start = nextFreeStart(entries, from, to, fallback) * 1000;
    open({ start: new Date(start), end: new Date(start + DEFAULT_MINUTES * 60_000) });
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey.current?.(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // The header date is the start of the day in the zone of the settings.
  const dayOf = (d: Date) => ymdIn(settings.tz, secs(d));
  const expected = (d: Date) => ([0, 6].includes(weekday(dayOf(d))) ? 0 : expectedMinutes(settings));
  const logged = (d: Date) => loggedMinutes(entries, ...dayBoundsIn(settings.tz, dayOf(d)));
  const name = (id: number) => categories.find((c) => c.id === id)?.name ?? "";

  return (
    <main className="wt-calendar">
      <button className="wt-chip" onClick={onSettings}>Settings</button>
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
            {slot.start.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })} to{" "}
            {slot.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <select className="wt-input" aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="wt-input" aria-label="Description" autoFocus value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="wt-chip is-primary" type="submit" disabled={!categoryId}>Save</button>
          <button className="wt-chip" type="button" onClick={close}>Cancel</button>
          <p className="wt-error" role="alert">{error}</p>
        </form>
      )}
      <FullCalendar
        ref={calendar}
        plugins={[timeGridPlugin, interactionPlugin, classicTheme]}
        timeZone={settings.tz}
        initialView="timeGridWeek"
        headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
        allDaySlot={false}
        firstDay={1}
        nowIndicator
        height="auto"
        slotDuration={{ minutes: SLOT_MINUTES }}
        snapDuration="00:15:00"
        scrollTime={settings.workStart + ":00"}
        selectable
        selectMirror
        selectOverlap={false}
        eventOverlap={false}
        selectMinDistance={5}
        dateClick={(i) => setPicked(i.date)}
        select={(i) => open({ start: i.start, end: i.end })}
        datesSet={(i) => setRange([secs(i.start), secs(i.end)])}
        events={[
          ...entries.map((e) => ({
            id: String(e.id),
            title: `${name(e.categoryId)}: ${e.description}`,
            start: new Date(e.startUtc * 1000),
            end: new Date(e.endUtc * 1000),
          })),
          ...(picked ? [{ start: picked, end: new Date(picked.getTime() + SLOT_MINUTES * 60_000), display: "background" }] : []),
        ]}
        dayHeaderContent={(i) => (
          <>
            <div>{i.text}</div>
            <div className="wt-sub">{formatHM(logged(i.date))} / {formatHM(expected(i.date))}</div>
          </>
        )}
        dayHeaderClass={(i) => logged(i.date) < expected(i.date) && "wt-day-short"}
      />
    </main>
  );
}
