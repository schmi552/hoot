import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Temporal } from "temporal-polyfill";
import { codeTaken, monthMinutes } from "./categoryRows";
import { ImportDialog } from "./Import";
import { localInput, MeetingAsk, MeetingDialog } from "./MeetingDialog";
import { instantAt, ymdIn } from "./schedule/schedule";
import { MeetingException, MeetingOccurrence, MeetingSeries, sourceText } from "./schedule/meetings";
import { hours, type Settings } from "./Settings";

type Category = { id: number; code: string; name: string; color: number };
const COLORS = [1, 2, 3, 4, 5, 6, 7, 8];
const COLOR_NAMES = ["Blue", "Orange", "Teal", "Purple", "Green", "Pink", "Amber", "Slate"];
const dot = (color: number) => ({ "--dot": `var(--cat-${color}-solid)` }) as React.CSSProperties;

/** The Categories table. Every change acts at once. */
export function Categories({ settings, categories, refresh }: { settings: Settings; categories: Category[]; refresh: () => void }) {
  const [used, setUsed] = useState<number[]>([]);
  const [minutes, setMinutes] = useState<Record<number, number>>({});
  const [picking, setPicking] = useState(0); // the id of the row that shows its color choices
  const [draft, setDraft] = useState<{ code: string; name: string } | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const { y, m } = ymdIn(settings.tz, Date.now() / 1000);
    const [from, to] = [instantAt(settings.tz, { y, m, d: 1 }), instantAt(settings.tz, { y, m: m + 1, d: 1 })];
    invoke<{ categoryId: number; startUtc: number; endUtc: number }[]>("list_entries", { fromUtc: from, toUtc: to }).then((e) => setMinutes(monthMinutes(e, from, to)));
    invoke<number[]>("used_categories").then(setUsed);
  }, [categories]);

  const fail = (e: unknown) => setMessage(String(e));
  const done = () => (setMessage(""), refresh());
  const month = new Date().toLocaleString("en", { month: "long", timeZone: settings.tz });
  const taken = !!draft && codeTaken(draft.code, categories);
  const add = () => {
    if (!draft || taken || !(draft.code.trim() || draft.name.trim())) return;
    const code = draft.code.trim();
    invoke("add_category", { code, name: draft.name.trim() || code }).then(() => (setDraft(null), done()), fail);
  };

  return (
    <section id="cats" className="wt-section">
      <div className="wt-section-head">
        <h2>Categories</h2>
        <button type="button" className="wt-chip" disabled={!!draft} onClick={() => setDraft({ code: "", name: "" })}>Add Category</button>
      </div>
      <div className="wt-table-card">
        <table className="wt-table">
          <thead>
            <tr><th>Color</th><th>Code</th><th>Name</th><th className="wt-num">{month}</th><th><span className="wt-sr">Action</span></th></tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className={picking === c.id ? "is-open" : undefined}>
                <td className="wt-color-cell">
                  <button type="button" className="wt-dot wt-dot-btn wt-dot-lg" style={dot(c.color)} aria-label={`Color of ${c.name}`} aria-expanded={picking === c.id} onClick={() => setPicking(picking === c.id ? 0 : c.id)} />
                  {picking === c.id && (
                    <div className="wt-swatches" role="group" aria-label="Category color" onKeyDown={(e) => e.key === "Escape" && setPicking(0)}>
                      {COLORS.map((n) => {
                        const owner = categories.find((o) => o.id !== c.id && o.color === n);
                        return (
                          <button
                            key={n}
                            type="button"
                            className={`wt-dot wt-dot-btn wt-dot-lg${owner ? " is-used" : ""}`}
                            style={dot(n)}
                            aria-label={`${COLOR_NAMES[n - 1]}${owner ? `, used by ${owner.code}` : ""}`}
                            aria-pressed={c.color === n}
                            onClick={() => invoke("update_category", { id: c.id, code: c.code, color: n }).then(() => (setPicking(0), done()), fail)}
                          />
                        );
                      })}
                      <span className="wt-hint">Faded = used by another Category.</span>
                    </div>
                  )}
                </td>
                <td className="wt-mono">{c.code}</td>
                <td>{c.name}</td>
                <td className="wt-num wt-mono">{hours(Math.round(minutes[c.id] ?? 0))}</td>
                <td className="wt-num">
                  <button type="button" className="wt-chip wt-chip-text" aria-label={`${used.includes(c.id) ? "Archive" : "Delete"} ${c.name}`} onClick={() => invoke("remove_category", { id: c.id }).then(done, fail)}>
                    {used.includes(c.id) ? "Archive" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
            {draft && (
              <tr onKeyDown={(e) => (e.key === "Enter" ? (e.preventDefault(), add()) : e.key === "Escape" && setDraft(null))}>
                <td><span className="wt-dot wt-dot-lg is-empty" /></td>
                <td><input className="wt-input wt-mono" aria-label="New Category code" placeholder="Code" size={8} autoFocus value={draft.code} aria-invalid={taken} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></td>
                <td><input className="wt-input" aria-label="New Category name" placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
                <td />
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="wt-error" role="alert">{taken ? "This code is already in the list." : message}</p>
    </section>
  );
}

/** A series as an occurrence at its own start, so the Meeting dialog can edit it. */
const firstOccurrence = (s: MeetingSeries): MeetingOccurrence => {
  const startUtc = Temporal.PlainDateTime.from(s.startLocal).toZonedDateTime(s.tz).epochMilliseconds / 1000;
  return { seriesId: s.id, categoryId: s.categoryId, title: s.title, tz: s.tz, originalStartLocal: s.startLocal, startUtc, endUtc: startUtc + s.durationMinutes * 60 };
};

const DAY_LABELS: Record<string, string> = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };

/** A series as one line, as in "Mon–Fri · 09:00 · 15 min". */
function pattern(s: MeetingSeries) {
  const rule = Object.fromEntries((s.rrule ?? "").split(";").map((p) => p.split("=")));
  const days: string[] = rule.BYDAY?.split(",") ?? [];
  const start = Temporal.PlainDateTime.from(s.startLocal);
  const day = start.toLocaleString("en", { weekday: "short" });
  const when = !s.rrule
    ? start.toLocaleString("en", { day: "numeric", month: "short" })
    : days.join() === "MO,TU,WE,TH,FR"
      ? "Mon–Fri"
      : rule.FREQ === "DAILY"
        ? "Daily"
        : rule.FREQ === "MONTHLY"
          ? "Monthly"
          : rule.FREQ === "WEEKLY"
            ? `Every ${days.map((d) => DAY_LABELS[d]).join(", ") || day}`
            : "Repeats";
  const d = s.durationMinutes;
  return `${when} · ${s.startLocal.slice(11, 16)} · ${d % 60 ? `${d} min` : d === 60 ? "1 h" : `${d / 60} h`}`;
}

/** The Recurring Meetings list. A click opens the Meeting dialog for the whole series. */
export function RecurringMeetings({ settings, categories }: { settings: Settings; categories: Category[] }) {
  const [series, setSeries] = useState<MeetingSeries[]>([]);
  const [exceptions, setExceptions] = useState<MeetingException[]>([]);
  const [ask, setAsk] = useState<MeetingAsk | null>(null);
  const [importing, setImporting] = useState(false);
  const load = () => {
    invoke<MeetingSeries[]>("list_meetings").then(setSeries);
    invoke<MeetingException[]>("list_meeting_exceptions").then(setExceptions);
  };
  useEffect(load, []);
  const close = () => (setAsk(null), setImporting(false), load());

  const edit = (s: MeetingSeries) => {
    const o = firstOccurrence(s);
    setAsk({ form: { title: s.title, categoryId: s.categoryId ?? 0, source: sourceText(s), start: localInput(settings.tz, o.startUtc), duration: s.durationMinutes, repeat: "none", editing: o } });
  };
  const add = () => setAsk({ form: { title: "", categoryId: categories[0]?.id ?? 0, source: "", start: localInput(settings.tz, Date.now() / 1000).slice(0, 13) + ":00", duration: 60, repeat: "weekly" } });

  return (
    <section id="meetings" className="wt-section">
      <div className="wt-section-head">
        <h2>Recurring Meetings</h2>
        <div className="wt-actions">
          <button type="button" className="wt-chip" onClick={() => setImporting(true)}>Import .ics …</button>
          <button type="button" className="wt-chip" onClick={add}>Add Meeting</button>
        </div>
      </div>
      {series.length === 0 && <p className="wt-hint">No Meetings yet.</p>}
      {series.length > 0 && (
        <ul className="wt-list">
          {series.map((s) => {
            const changed = exceptions.filter((x) => x.seriesId === s.id && x.kind === "override").length;
            const category = categories.find((c) => c.id === s.categoryId);
            return (
              <li key={s.id}>
                <button type="button" className="wt-list-row" onClick={() => edit(s)}>
                  <span className="wt-meeting-icon" style={category ? dot(category.color) : undefined} />
                  <b className="wt-list-title">{s.title}</b>
                  <span className="wt-hint wt-mono">{pattern(s)}</span>
                  {category && <span className="wt-caption-mono">{category.code}</span>}
                  <span className="wt-hint">{[changed ? `${changed} changed` : "", sourceText(s).replace(/^from .ics file$/, "from .ics")].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {ask && <MeetingDialog settings={settings} categories={categories} series={series} ask={ask} wholeSeries onClose={() => setAsk(null)} onDone={close} />}
      {importing && <ImportDialog settings={settings} categories={categories} onClose={() => setImporting(false)} onDone={() => close()} />}
    </section>
  );
}

/** Backups: the time of the newest copy, its folder and the restore. The restore replaces the data and restarts the app. */
export function Backups({ tz }: { tz: string }) {
  const [backup, setBackup] = useState<{ name: string; modifiedUtc: number } | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => void invoke<typeof backup>("latest_backup").then(setBackup, (e) => setMessage(String(e))), []);
  const when = backup ? new Date(backup.modifiedUtc * 1000).toLocaleString([], { timeZone: tz, dateStyle: "medium", timeStyle: "short" }) : "";

  return (
    <section id="back" className="wt-section">
      <h2>Backups</h2>
      <span className="wt-hint wt-intro">One copy per day at the first start. The last 7 are kept on this computer.</span>
      <div className={`wt-notice wt-notice-row${backup ? " is-success" : ""}`}>
        <span className="wt-notice-text">
          {backup && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" /></svg>
          )}
          <span>
            Last backup <b className="wt-mono">{backup === undefined ? "" : backup ? when : "None yet"}</b>
          </span>
        </span>
        <div className="wt-actions">
          <button type="button" className="wt-chip" onClick={() => invoke("show_backups_folder").catch((e) => setMessage(String(e)))}>Open folder</button>
          <button type="button" className="wt-chip" disabled={!backup} onClick={() => setConfirming(true)}>Restore …</button>
        </div>
      </div>
      {confirming && backup && (
        <form className="wt-notice is-warning wt-confirm" role="alertdialog" aria-label="Restore" onKeyDown={(e) => e.key === "Escape" && setConfirming(false)} onSubmit={(e) => e.preventDefault()}>
          <span>
            Restore <b className="wt-mono">{backup.name}</b> from {when}? Work Tracker replaces your data with this copy and restarts. Changes after that time are lost.
          </span>
          <div className="wt-actions">
            <button type="button" className="wt-chip" autoFocus onClick={() => setConfirming(false)}>Cancel</button>
            <button type="button" className="wt-chip is-primary" onClick={() => invoke("restore_and_restart").catch((e) => (setMessage(String(e)), setConfirming(false)))}>Restore and restart</button>
          </div>
        </form>
      )}
      <p className="wt-error" role="alert">{message}</p>
    </section>
  );
}
