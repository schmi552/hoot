import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { createContext, KeyboardEvent, useContext, useEffect, useId, useRef, useState } from "react";
import { dateKey, formatHM, gapDue, instantAt, minutesBetween, parseHM, popupDue, recentEntries, Span, splitGap, ymdIn } from "./schedule/schedule";
import { Absence, absenceSpans } from "./schedule/absences";
import { expandMeetings, MeetingException, MeetingSeries } from "./schedule/meetings";
import { Hoot, Mood } from "./Hoot";
import type { Settings } from "./Settings";
import type { Appearance } from "./theme";

type Entry = Span & { id: number; categoryId: number; description: string; tz: string };
type Category = { id: number; code: string; name: string; color: number };
type Ask = { now: number; settings: Settings; spans: Span[]; last: Entry | null; recents: Entry[]; categories: Category[]; today: string; askLocation: boolean; gap: boolean; previous: Entry | null; showMascot: boolean };
type Line = { me: boolean; text: string };

const SAVED_MS = 1500; // how long the saved state stays
const HISTORY_DAYS = 30;
const MAC = navigator.platform.startsWith("Mac");
const STILL_KEY = MAC ? "Cmd+Enter" : "Ctrl+Enter";

/** Read at each check-in, so a change applies at the next popup. */
const ShowMascot = createContext(true);

/** The always-on-top check-in window. It stays hidden until a tick says a popup is due. */
export function Popup() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const asking = useRef(false);
  const lastPrompt = useRef(0); // epoch seconds of the last answer; a skip leaves it alone, so the next tick asks again; lost on quit

  const show = (a: Ask | null) => {
    asking.current = !!a;
    setAsk(a);
    invoke("set_popup_visible", { visible: !!a });
  };
  const finish = (promptedUtc?: number) => {
    if (promptedUtc !== undefined) lastPrompt.current = promptedUtc;
    show(null);
  };

  useEffect(() => {
    // `force` is the debug button: it opens the popup even when no popup is due.
    const check = async (nowUtc: number, force = false) => {
      if (asking.current) return;
      const settings = await invoke<Settings | null>("get_settings");
      if (!settings) return;
      const entries = await invoke<Entry[]>("list_entries", { fromUtc: nowUtc - HISTORY_DAYS * 86_400, toUtc: nowUtc });
      // Meetings and Absences are both time the popup and the Gap leave out.
      const busy = [
        ...expandMeetings(await invoke<MeetingSeries[]>("list_meetings"), await invoke<MeetingException[]>("list_meeting_exceptions"), nowUtc - HISTORY_DAYS * 86_400, nowUtc + 86_400),
        ...absenceSpans(await invoke<Absence[]>("list_absences"), settings.tz),
      ];
      const gapSpans = gapDue(settings, nowUtc, entries, lastPrompt.current, busy);
      const spans = gapSpans ?? popupDue(settings, nowUtc, entries, lastPrompt.current, busy) ?? (force ? [{ startUtc: nowUtc - settings.intervalMinutes * 60, endUtc: nowUtc }] : null);
      if (!spans || asking.current) return;
      const categories = await invoke<Category[]>("list_categories");
      const last = entries.filter((e) => e.endUtc === spans[0].startUtc)[0] ?? null; // only an Entry that touches the span can be extended
      const today = dateKey(ymdIn(settings.tz, nowUtc));
      const askLocation = !(await invoke<unknown[]>("list_workday_locations", { from: today, to: today })).length; // the first popup of the day
      const previous = entries.filter((e) => e.endUtc <= spans[0].startUtc).sort((a, b) => b.endUtc - a.endUtc)[0] ?? null;
      show({ now: nowUtc, settings, spans, last, recents: recentEntries(entries), categories, today, askLocation, gap: !!gapSpans, previous, showMascot: (await invoke<Appearance>("get_appearance")).showMascot });
    };
    const unlisten = listen<{ nowUtc: number }>("tick", ({ payload }) => check(payload.nowUtc));
    const debug = listen("debug-popup", () => check(Math.floor(Date.now() / 1000), true));
    const closed = listen("popup-closed", () => asking.current && finish(Date.now() / 1000)); // closed with the window button
    return () => void [unlisten, debug, closed].forEach((u) => u.then((f) => f()));
  }, []);

  if (!ask) return null;
  return (
    <ShowMascot.Provider value={ask.showMascot}>
      {ask.gap ? <GapChat key={ask.now} ask={ask} onDone={finish} /> : <Chat key={ask.now} ask={ask} onDone={finish} />}
    </ShowMascot.Provider>
  );
}

function Chat({ ask, onDone }: { ask: Ask; onDone: (promptedUtc?: number) => void }) {
  const { now, settings, spans, last, recents, categories, today } = ask;
  const asked = useRef(ask.askLocation); // the popup began with the location question, so the thread keeps its answer
  const [askLocation, setAskLocation] = useState(ask.askLocation);
  const [place, setPlace] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(recents[0]?.categoryId ?? categories[0]?.id ?? 0);
  const [error, setError] = useState(categories.length ? "" : "Add a Category in Settings first.");
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false); // the last write failed, so the error line offers a retry
  const again = useRef(false); // whether the failed save was "still"
  const written = useRef(0); // spans already stored, so a retry after a failure does not store them twice
  const input = useRef<HTMLInputElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const time = (t: number) => new Date(t * 1000).toLocaleTimeString([], { timeZone: settings.tz, hour: "2-digit", minute: "2-digit" });
  const category = categories.find((c) => c.id === categoryId);
  const [savedCode, setSavedCode] = useState("");

  const question = last ? `Still on "${last.description}"?` : `What did you do since ${time(spans[0].startUtc)}?`;
  useEffect(() => void (thread.current!.scrollTop = thread.current!.scrollHeight), [lines, saved, place]);

  const save = async (still: boolean) => {
    const source = still ? last! : { description: description.trim(), categoryId };
    if (!source.description) return setError("Type what you did.");
    if (!source.categoryId) return setError("Pick a Category.");
    const answer = still ? "Yes, still" : `${source.description} (${category?.name})`;
    again.current = still;
    setFailed(false); // a retry puts Hoot back to Asking until the write fails again
    const create = (s: Span) => invoke("create_entry", { entry: { id: 0, categoryId: source.categoryId, description: source.description, startUtc: s.startUtc, endUtc: s.endUtc, tz: settings.tz } });
    try {
      // Lunch can split the span in two: the first part extends the last Entry, the rest are new.
      for (; written.current < spans.length; written.current++) {
        const s = spans[written.current];
        if (still && written.current === 0) await invoke("update_entry", { entry: { ...last, endUtc: s.endUtc } });
        else await create(s);
      }
    } catch (e) {
      return fail(e, setError, setFailed); // the answer stays in the form, so Enter tries again
    }
    emit("entries-changed");
    setError("");
    setLines([{ me: true, text: answer }]);
    setSavedCode(categories.find((c) => c.id === source.categoryId)?.code ?? "");
    setSaved(true);
    setTimeout(() => onDone(now), SAVED_MS);
  };

  const setLocation = async (location: "home" | "office") => {
    try {
      await invoke("set_workday_location", { date: today, location });
    } catch (e) {
      return setError(String(e));
    }
    emit("entries-changed");
    setError("");
    setPlace(location === "home" ? "Home" : "Office");
    setAskLocation(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") saved ? onDone(now) : onDone(); // a skip is not an answer
    else if (askLocation) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() === "h") setLocation("home");
      else if (e.key.toLowerCase() === "o") setLocation("office");
    } else if (e.key === "Enter" && !saved && (e.target as HTMLElement).tagName !== "BUTTON") (MAC ? e.metaKey : e.ctrlKey) ? last && save(true) : save(false);
  };

  return (
    <div className="wt-popup wt-popup--window" role="dialog" aria-label="Work Tracker check-in" tabIndex={0} onKeyDown={onKeyDown} >
      <div className="wt-head">
        <b>Work Tracker</b>
        <span className="wt-sub">{time(now)} · Esc {saved ? "close" : "skip"}</span>
      </div>
      <div className="wt-thread" ref={thread} role="log" aria-live="polite" aria-label="Conversation with Work Tracker">
        {asked.current && <Say text="Are you working from home or in the office today?" />}
        {asked.current && place && <div className="wt-me">{place}</div>}
        {!askLocation && <Say text={question} mood={failed ? "problem" : "asking"} />}
        {lines.map((l, i) => (l.me ? <div key={i} className="wt-me">{l.text}</div> : <Say key={i} text={l.text} />))}
        {saved && <Say text={`Saved: ${time(spans[0].startUtc)} to ${time(spans[spans.length - 1].endUtc)}${savedCode ? ` on ${savedCode}` : ""}. See you at the next tick!`} mood="saved" />}
      </div>
      {askLocation ? (
        <div className="wt-quick" role="group" aria-label="Workday location">
          <button type="button" autoFocus className="wt-chip is-primary" onClick={() => setLocation("home")}>Home (H)</button>
          <button type="button" className="wt-chip is-primary" onClick={() => setLocation("office")}>Office (O)</button>
          <ErrorLine error={error} />
        </div>
      ) : !saved && (
        <>
          <div className="wt-quick" role="group" aria-label="Quick replies">
            {last && <button type="button" className="wt-chip is-primary" onClick={() => save(true)}>Yes, still ({STILL_KEY})</button>}
            {recents.map((r) => (
              <button type="button" key={r.id} className="wt-chip" title={categories.find((c) => c.id === r.categoryId)?.name} onClick={() => { setDescription(r.description); setCategoryId(r.categoryId); input.current?.focus(); }}>
                {r.description}
              </button>
            ))}
          </div>
          <div className="wt-composer">
            <div className="wt-row">
              <span className="wt-label">Category</span>
              <div style={{ flex: 1 }}><Combo options={categories} value={categoryId} onChange={setCategoryId} /></div>
            </div>
            <div className="wt-row">
              <input ref={input} autoFocus className="wt-input" aria-label="What did you do" placeholder={last ? "...or tell me what you did instead" : "What did you do?"} value={description} onChange={(e) => setDescription(e.target.value)} />
              <button type="button" className="wt-chip is-primary" onClick={() => save(false)}>Send</button>
            </div>
            <ErrorLine error={error} retry={failed ? () => save(again.current) : undefined} />
          </div>
        </>
      )}
    </div>
  );
}

/** Show a failed write. The popup may be hidden by now, so the app also tells the user outside the window. */
function fail(e: unknown, setError: (m: string) => void, setFailed: (f: boolean) => void) {
  setError(String(e));
  setFailed(true);
  invoke("report_save_failure");
}

/** The popup for a Gap: accept it as one Entry, split it at one time, or leave it empty. Nothing is saved until the user answers. */
function GapChat({ ask, onDone }: { ask: Ask; onDone: (promptedUtc?: number) => void }) {
  const { now, settings, spans, previous, recents, categories } = ask;
  const [mode, setMode] = useState<"choose" | "accept" | "split">("choose");
  const [lines, setLines] = useState<string[]>([]); // the user's choices, shown as their own bubbles
  const [from, setFrom] = useState(""); // "HH:MM", where the new part of a split starts
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(recents[0]?.categoryId ?? categories[0]?.id ?? 0);
  const [error, setError] = useState(categories.length ? "" : "Add a Category in Settings first.");
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false); // the last write failed, so the error line offers a retry
  const written = useRef(0); // writes already done, so a retry after a failure does not store them twice
  const time = (t: number) => new Date(t * 1000).toLocaleTimeString([], { timeZone: settings.tz, hour: "2-digit", minute: "2-digit" });
  const start = spans[0].startUtc;
  const end = spans[spans.length - 1].endUtc;
  const minutes = minutesBetween(start, end) - spans.slice(1).reduce((sum, p, i) => sum + minutesBetween(spans[i].endUtc, p.startUtc), 0);
  const ymd = ymdIn(settings.tz, now);
  const canSplit = !!previous; // the part before the new time continues the last Entry

  const choose = (m: "accept" | "split" | "leave") => {
    if (m === "split" && !canSplit) return;
    setLines([m === "accept" ? "Accept it" : m === "split" ? "Split it" : "Leave it empty"]);
    if (m === "leave") setTimeout(() => onDone(now), SAVED_MS);
    else setMode(m);
  };

  const save = async () => {
    const cut = mode === "split" ? (from ? instantAt(settings.tz, ymd, parseHM(from)) : NaN) : -Infinity;
    if (mode === "split" && !(cut > start && cut < end)) return setError("New from must be inside the Gap.");
    const [before, after] = mode === "split" ? splitGap(spans, [cut]) : [[], spans];
    if (!after.length) return setError("The new part must hold work time.");
    if (mode === "split" && !before.length) return setError("The part before must hold work time.");
    if (!description.trim()) return setError("Type what you did.");
    if (!categoryId) return setError("Pick a Category.");
    const entry = (s: Span, e: { categoryId: number; description: string }) => ({ id: 0, categoryId: e.categoryId, description: e.description, startUtc: s.startUtc, endUtc: s.endUtc, tz: settings.tz });
    const writes = [
      ...before.map((s, i) => () => (i === 0 && previous!.endUtc === s.startUtc ? invoke("update_entry", { entry: { ...previous, endUtc: s.endUtc } }) : invoke("create_entry", { entry: entry(s, previous!) }))),
      ...after.map((s) => () => invoke("create_entry", { entry: entry(s, { categoryId, description: description.trim() }) })),
    ];
    try {
      for (; written.current < writes.length; written.current++) await writes[written.current]();
    } catch (e) {
      return fail(e, setError, setFailed);
    }
    emit("entries-changed");
    setError("");
    setFailed(false);
    setSaved(true);
    setTimeout(() => onDone(now), SAVED_MS);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onDone(now);
    else if (mode === "choose" && !lines.length && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "a") choose("accept");
      else if (k === "s") choose("split");
      else if (k === "l") choose("leave");
    } else if (mode !== "choose" && e.key === "Enter" && !saved && (e.target as HTMLElement).tagName !== "BUTTON") save();
  };

  return (
    <div className="wt-popup wt-popup--window" role="dialog" aria-label="Work Tracker gap" tabIndex={0} autoFocus onKeyDown={onKeyDown}>
      <div className="wt-head">
        <b>Work Tracker</b>
        <span className="wt-sub">{time(now)} · Esc skip</span>
      </div>
      <div className="wt-thread" role="log" aria-live="polite" aria-label="Conversation with Work Tracker">
        <Say text={`Nothing is logged from ${time(start)} to ${time(end)} (${formatHM(minutes)}). What did you do?`} mood={failed ? "problem" : "away"} />
        {lines.map((l, i) => <div key={i} className="wt-me">{l}</div>)}
        {saved && <Say text="Saved. See you next time!" mood="saved" />}
      </div>
      {mode === "choose" && !lines.length && (
        <div className="wt-quick" role="group" aria-label="Gap choices">
          <button type="button" autoFocus className="wt-chip is-primary" onClick={() => choose("accept")}>Accept (A)</button>
          {canSplit && <button type="button" className="wt-chip" onClick={() => choose("split")}>Split (S)</button>}
          <button type="button" className="wt-chip" onClick={() => choose("leave")}>Leave empty (L)</button>
        </div>
      )}
      {mode !== "choose" && !saved && (
        <div className="wt-composer">
          {mode === "split" && (
            <div className="wt-row">
              <span className="wt-label">New from</span>
              <input autoFocus className="wt-input" type="time" aria-label="New from" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
          )}
          <div className="wt-row">
            <span className="wt-label">Category</span>
            <div style={{ flex: 1 }}><Combo options={categories} value={categoryId} onChange={setCategoryId} /></div>
          </div>
          <div className="wt-row">
            <input autoFocus={mode === "accept"} className="wt-input" aria-label="What did you do" placeholder="What did you do?" value={description} onChange={(e) => setDescription(e.target.value)} />
            <button type="button" className="wt-chip is-primary" onClick={save}>Save</button>
          </div>
          <ErrorLine error={error} retry={failed ? save : undefined} />
        </div>
      )}
    </div>
  );
}

/** An error line. After a failed write it also offers Retry and Copy. */
export function ErrorLine({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div className="wt-error" role="alert">
      {error}
      {error && retry && (
        <>
          {" "}
          <button type="button" className="wt-chip" onClick={retry}>Retry</button>
          <button type="button" className="wt-chip" onClick={() => navigator.clipboard.writeText(error)}>Copy</button>
        </>
      )}
    </div>
  );
}

/** A line from the mascot. */
function Say({ text, mood }: { text: string; mood?: Mood }) {
  const showMascot = useContext(ShowMascot);
  return (
    <div className="wt-bot">
      <Hoot px={3} mood={mood} show={showMascot} />
      <div className="wt-bubble">{text}</div>
    </div>
  );
}

/** A Category field that holds the chosen Category. Its list opens upward. */
function Combo({ options, value, onChange }: { options: Category[]; value: number; onChange: (id: number) => void }) {
  const label = (o: Category) => (o.code ? `${o.code} ${o.name}` : o.name);
  const chosen = options.find((o) => o.id === value);
  const name = chosen ? label(chosen) : "";
  const id = useId();
  const [text, setText] = useState(name);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => setText(name), [name]);
  const shown = text === name ? options : options.filter((o) => label(o).toLowerCase().includes(text.toLowerCase()));
  const pick = (o: Category) => { onChange(o.id); setText(label(o)); setOpen(false); };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(Math.max(a + (e.key === "ArrowDown" ? 1 : -1), 0), shown.length - 1));
    } else if (open && e.key === "Enter" && shown[active]) { e.stopPropagation(); pick(shown[active]); }
    else if (open && e.key === "Escape") { e.stopPropagation(); setOpen(false); setText(name); }
  };
  return (
    <div className="wt-combo">
      <input className="wt-input" role="combobox" aria-label="Category" aria-expanded={open} aria-controls={id} aria-autocomplete="list" placeholder="Category (type to filter)"
        value={text} onChange={(e) => { setText(e.target.value); setActive(0); setOpen(true); }} onBlur={() => { setOpen(false); setText(name); }} onKeyDown={onKeyDown} />
      {open && shown.length > 0 && (
        <ul id={id} role="listbox">
          {shown.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === active} className={i === active ? "is-active" : ""} onMouseDown={(e) => { e.preventDefault(); pick(o); }}><span className="wt-dot" style={{ "--dot": `var(--cat-${o.color}-solid)` } as React.CSSProperties} />{label(o)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
