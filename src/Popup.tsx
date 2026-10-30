import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { popupDue, recentEntries, Span } from "./schedule/schedule";
import type { Settings } from "./Settings";

type Entry = Span & { id: number; categoryId: number; description: string; tz: string };
type Category = { id: number; name: string };
type Ask = { now: number; settings: Settings; spans: Span[]; last: Entry | null; recents: Entry[]; categories: Category[] };
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
    const unlisten = listen<{ nowUtc: number }>("tick", async ({ payload: { nowUtc } }) => {
      if (asking.current) return;
      const settings = await invoke<Settings | null>("get_settings");
      if (!settings) return;
      const entries = await invoke<Entry[]>("list_entries", { fromUtc: nowUtc - HISTORY_DAYS * 86_400, toUtc: nowUtc });
      const spans = popupDue(settings, nowUtc, entries, lastPrompt.current);
      if (!spans || asking.current) return;
      const categories = await invoke<Category[]>("list_categories");
      const last = entries.filter((e) => e.endUtc === spans[0].startUtc)[0] ?? null; // only an Entry that touches the span can be extended
      show({ now: nowUtc, settings, spans, last, recents: recentEntries(entries), categories });
    });
    const closed = listen("popup-closed", () => asking.current && finish(Date.now() / 1000)); // closed with the window button
    return () => void [unlisten, closed].forEach((u) => u.then((f) => f()));
  }, []);

  if (!ask) return null;
  return <Chat key={ask.now} ask={ask} onDone={finish} />;
}

function Chat({ ask, onDone }: { ask: Ask; onDone: (promptedUtc: number) => void }) {
  const { now, settings, spans, last, recents, categories } = ask;
  const [lines, setLines] = useState<Line[]>([]);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(recents[0]?.categoryId ?? categories[0]?.id ?? 0);
  const [error, setError] = useState(categories.length ? "" : "Add a Category in Settings first.");
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const time = (t: number) => new Date(t * 1000).toLocaleTimeString([], { timeZone: settings.tz, hour: "2-digit", minute: "2-digit" });
  const category = categories.find((c) => c.id === categoryId);

  const question = last ? `Still on "${last.description}"?` : `What did you do since ${time(spans[0].startUtc)}?`;
  useEffect(() => void (thread.current!.scrollTop = thread.current!.scrollHeight), [lines, saved]);

  const save = async (still: boolean) => {
    const source = still ? last! : { description: description.trim(), categoryId };
    if (!source.description) return setError("Type what you did.");
    if (!source.categoryId) return setError("Pick a Category.");
    const answer = still ? "Yes, still" : `${source.description} (${category?.name})`;
    const [first, ...rest] = spans;
    const create = (s: Span) => invoke("create_entry", { entry: { id: 0, categoryId: source.categoryId, description: source.description, startUtc: s.startUtc, endUtc: s.endUtc, tz: settings.tz } });
    try {
      // Lunch can split the span in two: the first part extends the last Entry, the rest are new.
      if (still) await invoke("update_entry", { entry: { ...last, endUtc: first.endUtc } });
      else await create(first);
      for (const s of rest) await create(s);
    } catch (e) {
      return setError(String(e)); // the answer stays in the form, so Enter tries again
    }
    emit("entries-changed");
    setError("");
    setLines([{ me: true, text: answer }]);
    setSaved(true);
    setTimeout(() => onDone(now), 1200);
  };

  const snooze = () => onDone(now + SNOOZE_MINUTES * 60 - settings.intervalMinutes * 60);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onDone(now);
    else if (e.key === "Enter" && !saved && (e.target as HTMLElement).tagName !== "BUTTON") (e.ctrlKey || e.metaKey) ? last && save(true) : save(false);
  };

  return (
    <div className="wt-popup wt-popup--window" role="dialog" aria-label="Work Tracker check-in" tabIndex={0} onKeyDown={onKeyDown} >
      <div className="wt-head">
        <b>Work Tracker</b>
        <span className="wt-sub">{time(now)} · Esc skip</span>
      </div>
      <div className="wt-thread" ref={thread} role="log" aria-live="polite" aria-label="Conversation with Work Tracker">
        <Say text={question} />
        {lines.map((l, i) => (l.me ? <div key={i} className="wt-me">{l.text}</div> : <Say key={i} text={l.text} />))}
        {saved && <Say text="Saved. See you next time!" />}
      </div>
      {!saved && (
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
            <div className="wt-error" role="alert">{error}</div>
          </div>
        </>
      )}
    </div>
  );
}

/** A line from the mascot. The mascot is a placeholder: a 10 x 9 pixel grid. */
const SPRITE = ["..xxxxxx..", ".xxxxxxxx.", "xxxxxxxxxx", "xxexxxxexx", "xxxxxxxxxx", "xxxmmmmxxx", ".xxxxxxxx.", ".xxxxxxxx.", ".xx.xx.xx."];
const PIXEL = { x: "var(--color-mascot-body)", e: "var(--color-mascot-eye)", m: "var(--color-mascot-mouth)" } as Record<string, string>;
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
      <input className="wt-input" role="combobox" aria-label="Category" aria-expanded={open} aria-controls="categories" aria-autocomplete="list" placeholder="Category (type to filter)"
        value={text} onChange={(e) => { setText(e.target.value); setActive(0); setOpen(true); }} onBlur={() => { setOpen(false); setText(name); }} onKeyDown={onKeyDown} />
      {open && shown.length > 0 && (
        <ul id="categories" role="listbox">
          {shown.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === active} className={i === active ? "is-active" : ""} onMouseDown={(e) => { e.preventDefault(); pick(o); }}>{o.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
