import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { dateKey, formatHM, gapDue, instantAt, minutesBetween, parseHM, popupDue, recentEntries, Span, splitGap, ymdIn } from "./schedule/schedule";
import { Absence, absenceSpans } from "./schedule/absences";
import { expandMeetings, MeetingException, MeetingSeries } from "./schedule/meetings";
import type { Settings } from "./Settings";

type Entry = Span & { id: number; categoryId: number; description: string; tz: string };
type Category = { id: number; name: string };
type Ask = { now: number; settings: Settings; spans: Span[]; last: Entry | null; recents: Entry[]; categories: Category[]; today: string; askLocation: boolean; gap: boolean; previous: Entry | null };
type Line = { me: boolean; text: string };

const SNOOZE_MINUTES = 5;
const HISTORY_DAYS = 30;
const MAC = navigator.platform.startsWith("Mac");
const STILL_KEY = MAC ? "Cmd+Enter" : "Ctrl+Enter";

/** The always-on-top check-in window. It stays hidden until a tick says a popup is due. */
export function Popup() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const asking = useRef(false);
  const lastPrompt = useRef(0); // epoch seconds of the last answer, skip or snooze; lost on quit

  const show = (a: Ask | null) => {
    asking.current = !!a;
    setAsk(a);
    invoke("set_popup_visible", { visible: !!a });
  };
  const finish = (promptedUtc: number) => {
    lastPrompt.current = promptedUtc;
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
      show({ now: nowUtc, settings, spans, last, recents: recentEntries(entries), categories, today, askLocation, gap: !!gapSpans, previous });
    };
    const unlisten = listen<{ nowUtc: number }>("tick", ({ payload }) => check(payload.nowUtc));
    const debug = listen("debug-popup", () => check(Math.floor(Date.now() / 1000), true));
    const closed = listen("popup-closed", () => asking.current && finish(Date.now() / 1000)); // closed with the window button
    return () => void [unlisten, debug, closed].forEach((u) => u.then((f) => f()));
  }, []);

  if (!ask) return null;
  return ask.gap ? <GapChat key={ask.now} ask={ask} onDone={finish} /> : <Chat key={ask.now} ask={ask} onDone={finish} />;
}

function Chat({ ask, onDone }: { ask: Ask; onDone: (promptedUtc: number) => void }) {
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

  const question = last ? `Still on "${last.description}"?` : `What did you do since ${time(spans[0].startUtc)}?`;
  useEffect(() => void (thread.current!.scrollTop = thread.current!.scrollHeight), [lines, saved, place]);

  const save = async (still: boolean) => {
    const source = still ? last! : { description: description.trim(), categoryId };
    if (!source.description) return setError("Type what you did.");
    if (!source.categoryId) return setError("Pick a Category.");
    const answer = still ? "Yes, still" : `${source.description} (${category?.name})`;
    again.current = still;
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
    setFailed(false);
    setLines([{ me: true, text: answer }]);
    setSaved(true);
    setTimeout(() => onDone(now), 1200);
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

  const snooze = () => onDone(now + SNOOZE_MINUTES * 60 - settings.intervalMinutes * 60);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onDone(now);
    else if (askLocation) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() === "h") setLocation("home");
      else if (e.key.toLowerCase() === "o") setLocation("office");
    } else if (e.key === "Enter" && !saved && (e.target as HTMLElement).tagName !== "BUTTON") (e.ctrlKey || e.metaKey) ? last && save(true) : save(false);
  };

  return (
    <div className="wt-popup wt-popup--window" role="dialog" aria-label="Work Tracker check-in" tabIndex={0} onKeyDown={onKeyDown} >
      <div className="wt-head">
        <b>Work Tracker</b>
        <span className="wt-sub">{time(now)} · Esc skip</span>
      </div>
      <div className="wt-thread" ref={thread} role="log" aria-live="polite" aria-label="Conversation with Work Tracker">
        {asked.current && <Say text="Are you working from home or in the office today?" />}
        {asked.current && place && <div className="wt-me">{place}</div>}
        {!askLocation && <Say text={question} />}
        {lines.map((l, i) => (l.me ? <div key={i} className="wt-me">{l.text}</div> : <Say key={i} text={l.text} />))}
        {saved && <Say text="Saved. See you next time!" />}
      </div>
      {askLocation ? (
        <div className="wt-quick" role="group" aria-label="Workday location">
          <button type="button" autoFocus className="wt-chip is-primary" onClick={() => setLocation("home")}>Home (H)</button>
          <button type="button" className="wt-chip is-primary" onClick={() => setLocation("office")}>Office (O)</button>
          <button type="button" className="wt-chip" onClick={snooze}>Snooze {SNOOZE_MINUTES} min</button>
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
            <button type="button" className="wt-chip" onClick={snooze}>Snooze {SNOOZE_MINUTES} min</button>
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

type Part = { until: string; description: string; categoryId: number }; // `until` is "HH:MM"; the last part has none

/** The popup for a Gap: accept it as one Entry, split it into parts, or leave it empty. Nothing is saved until the user answers. */
function GapChat({ ask, onDone }: { ask: Ask; onDone: (promptedUtc: number) => void }) {
  const { now, settings, spans, previous, recents, categories } = ask;
  const [mode, setMode] = useState<"choose" | "accept" | "split">("choose");
  const firstCategory = recents[0]?.categoryId ?? categories[0]?.id ?? 0;
  const blank = (): Part => ({ until: "", description: "", categoryId: firstCategory });
  const [parts, setParts] = useState<Part[]>([blank()]);
  const [error, setError] = useState(categories.length ? "" : "Add a Category in Settings first.");
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false); // the last write failed, so the error line offers a retry
  const written = useRef(0); // Entries already stored, so a retry after a failure does not store them twice
  const time = (t: number) => new Date(t * 1000).toLocaleTimeString([], { timeZone: settings.tz, hour: "2-digit", minute: "2-digit" });
  const start = spans[0].startUtc;
  const end = spans[spans.length - 1].endUtc;
  const minutes = minutesBetween(start, end) - spans.slice(1).reduce((sum, p, i) => sum + minutesBetween(spans[i].endUtc, p.startUtc), 0);
  const ymd = ymdIn(settings.tz, now);

  const choose = (m: "accept" | "split") => {
    setMode(m);
    setParts(m === "accept" ? [blank()] : [blank(), blank()]);
  };
  const change = (i: number, p: Partial<Part>) => setParts((all) => all.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const save = async () => {
    const cuts = parts.slice(0, -1).map((p) => (p.until ? instantAt(settings.tz, ymd, parseHM(p.until)) : NaN));
    if (cuts.some((c, i) => !(c > (cuts[i - 1] ?? start) && c < end))) return setError("Split times must rise and stay inside the Gap.");
    const split = splitGap(spans, cuts);
    const pieces = split.flatMap((ss, i) => ss.map((s) => ({ ...parts[i], ...s })));
    if (split.some((ss) => !ss.length)) return setError("A part must hold work time.");
    if (parts.some((p) => !p.description.trim())) return setError("Type what you did in every part.");
    if (parts.some((p) => !p.categoryId)) return setError("Pick a Category for every part.");
    try {
      for (; written.current < pieces.length; written.current++) {
        const p = pieces[written.current];
        await invoke("create_entry", { entry: { id: 0, categoryId: p.categoryId, description: p.description.trim(), startUtc: p.startUtc, endUtc: p.endUtc, tz: settings.tz } });
      }
    } catch (e) {
      return fail(e, setError, setFailed);
    }
    emit("entries-changed");
    setError("");
    setFailed(false);
    setSaved(true);
    setTimeout(() => onDone(now), 1200);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onDone(now);
    else if (mode === "choose" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "a") choose("accept");
      else if (k === "s") choose("split");
      else if (k === "l") onDone(now);
    } else if (mode !== "choose" && e.key === "Enter" && !saved && (e.target as HTMLElement).tagName !== "BUTTON") save();
  };

  return (
    <div className="wt-popup wt-popup--window" role="dialog" aria-label="Work Tracker gap" tabIndex={0} autoFocus onKeyDown={onKeyDown}>
      <div className="wt-head">
        <b>Work Tracker</b>
        <span className="wt-sub">{time(now)} · Esc skip</span>
      </div>
      <div className="wt-thread" role="log" aria-live="polite" aria-label="Conversation with Work Tracker">
        <Say text={`Nothing is logged from ${time(start)} to ${time(end)} (${formatHM(minutes)}). What did you do?`} />
        {saved && <Say text="Saved. See you next time!" />}
      </div>
      {mode === "choose" && (
        <div className="wt-quick" role="group" aria-label="Gap choices">
          <button type="button" autoFocus className="wt-chip is-primary" onClick={() => choose("accept")}>Accept as one Entry (A)</button>
          <button type="button" className="wt-chip" onClick={() => choose("split")}>Split (S)</button>
          <button type="button" className="wt-chip" onClick={() => onDone(now)}>Leave empty (L)</button>
          {previous && (
            <button type="button" className="wt-chip" title={`Previous Entry, ${categories.find((c) => c.id === previous.categoryId)?.name}`} onClick={() => { setMode("accept"); setParts([{ until: "", description: previous.description, categoryId: previous.categoryId }]); }}>
              Previous: {previous.description}
            </button>
          )}
        </div>
      )}
      {mode !== "choose" && !saved && (
        <div className="wt-composer">
          {parts.map((p, i) => (
            <div key={i}>
              {mode === "split" && (
                <div className="wt-row">
                  <span className="wt-label">Part {i + 1}</span>
                  {i < parts.length - 1 ? (
                    <><span className="wt-label">until</span><input className="wt-input" type="time" aria-label={`Part ${i + 1} ends at`} value={p.until} onChange={(e) => change(i, { until: e.target.value })} /></>
                  ) : <span className="wt-label">until {time(end)}</span>}
                </div>
              )}
              <div className="wt-row">
                <span className="wt-label">Category</span>
                <div style={{ flex: 1 }}><Combo options={categories} value={p.categoryId} onChange={(categoryId) => change(i, { categoryId })} /></div>
              </div>
              <div className="wt-row">
                <input autoFocus={i === 0} className="wt-input" aria-label={`What did you do${mode === "split" ? `, part ${i + 1}` : ""}`} placeholder="What did you do?" value={p.description} onChange={(e) => change(i, { description: e.target.value })} />
              </div>
            </div>
          ))}
          <div className="wt-row">
            {mode === "split" && <button type="button" className="wt-chip" onClick={() => setParts((all) => [...all.slice(0, -1), blank(), all[all.length - 1]])}>Add part</button>}
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

/** A line from the mascot. The mascot is a placeholder: a 10 x 9 pixel grid. */
const SPRITE = ["..xxxxxx..", ".xxxxxxxx.", "xxxxxxxxxx", "xxexxxxexx", "xxxxxxxxxx", "xxxmmmmxxx", ".xxxxxxxx.", ".xxxxxxxx.", ".xx.xx.xx."];
const PIXEL = { x: "var(--color-mascot-body)", e: "var(--color-mascot-eye)", m: "var(--color-mascot-beak)" } as Record<string, string>;
function Say({ text }: { text: string }) {
  return (
    <div className="wt-bot">
      <svg aria-hidden="true" width="30" height="27" viewBox="0 0 10 9" shapeRendering="crispEdges" style={{ flex: "none" }}>
        {SPRITE.flatMap((row, y) => [...row].map((c, x) => c !== "." && <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill={PIXEL[c]} />))}
      </svg>
      <div className="wt-bubble">{text}</div>
    </div>
  );
}

/** A Category field that holds the chosen Category. Its list opens upward. */
function Combo({ options, value, onChange }: { options: Category[]; value: number; onChange: (id: number) => void }) {
  const name = options.find((o) => o.id === value)?.name ?? "";
  const id = useId();
  const [text, setText] = useState(name);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => setText(name), [name]);
  const shown = text === name ? options : options.filter((o) => o.name.toLowerCase().includes(text.toLowerCase()));
  const pick = (o: Category) => { onChange(o.id); setText(o.name); setOpen(false); };
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
            <li key={o.id} role="option" aria-selected={i === active} className={i === active ? "is-active" : ""} onMouseDown={(e) => { e.preventDefault(); pick(o); }}>{o.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
