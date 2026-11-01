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
  const taken = !!draft && codeTaken(draft.code, categories);
  const add = () => {
    if (!draft || taken || !(draft.code.trim() || draft.name.trim())) return;
    const code = draft.code.trim();
    invoke("add_category", { code, name: draft.name.trim() || code }).then(() => (setDraft(null), done()), fail);
  };

  return (
    <section id="cats" className="wt-section">
      <h2>Categories</h2>
      <table className="wt-table">
        <thead>
          <tr><th>Color</th><th>Code</th><th>Name</th><th className="wt-num">This month</th><th><span className="wt-sr">Action</span></th></tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <td>
                <button type="button" className="wt-dot wt-dot-btn" style={dot(c.color)} aria-label={`Color of ${c.name}`} aria-expanded={picking === c.id} onClick={() => setPicking(picking === c.id ? 0 : c.id)} />
                {picking === c.id && (
                  <span className="wt-swatches">
                    {COLORS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="wt-dot wt-dot-btn"
                        style={dot(n)}
                        aria-label={`Color ${n} for ${c.name}`}
                        aria-pressed={c.color === n}
                        onClick={() => invoke("update_category", { id: c.id, code: c.code, color: n }).then(() => (setPicking(0), done()), fail)}
                      />
                    ))}
                  </span>
                )}
              </td>
              <td className="wt-mono">{c.code}</td>
              <td>{c.name}</td>
              <td className="wt-num wt-mono">{hours(Math.round(minutes[c.id] ?? 0))}</td>
              <td className="wt-num">
                <button type="button" className="wt-chip" aria-label={`${used.includes(c.id) ? "Archive" : "Delete"} ${c.name}`} onClick={() => invoke("remove_category", { id: c.id }).then(done, fail)}>
                  {used.includes(c.id) ? "Archive" : "Delete"}
                </button>
              </td>
            </tr>
          ))}
          {draft && (
            <tr onKeyDown={(e) => (e.key === "Enter" ? (e.preventDefault(), add()) : e.key === "Escape" && setDraft(null))}>
              <td><span className="wt-dot is-empty" /></td>
              <td><input className="wt-input wt-mono" aria-label="New Category code" placeholder="Code" size={8} autoFocus value={draft.code} aria-invalid={taken} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></td>
              <td><input className="wt-input" aria-label="New Category name" placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
              <td />
              <td />
            </tr>
          )}
        </tbody>
      </table>
      <p className="wt-error" role="alert">{taken ? "This code is already in the list." : message}</p>
      <div className="wt-actions">
        <button type="button" className="wt-chip" disabled={!!draft} onClick={() => setDraft({ code: "", name: "" })}>Add Category</button>
      </div>
    </section>
  );
}

/** A series as an occurrence at its own start, so the Meeting dialog can edit it. */
const firstOccurrence = (s: MeetingSeries): MeetingOccurrence => {
  const startUtc = Temporal.PlainDateTime.from(s.startLocal).toZonedDateTime(s.tz).epochMilliseconds / 1000;
  return { seriesId: s.id, categoryId: s.categoryId, title: s.title, tz: s.tz, originalStartLocal: s.startLocal, startUtc, endUtc: startUtc + s.durationMinutes * 60 };
};

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
      <h2>Recurring Meetings</h2>
      {series.length === 0 && <p className="wt-hint">No Meetings yet.</p>}
      <ul className="wt-list">
        {series.map((s) => {
          const changed = exceptions.filter((x) => x.seriesId === s.id && x.kind === "override").length;
          return (
            <li key={s.id}>
              <button type="button" className="wt-list-row" onClick={() => edit(s)}>
                <span>{s.title}</span>
                <span className="wt-hint">{[changed ? `${changed} changed` : "", sourceText(s)].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="wt-actions">
        <button type="button" className="wt-chip" onClick={add}>Add Meeting</button>
        <button type="button" className="wt-chip" onClick={() => setImporting(true)}>Import .ics …</button>
      </div>
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
      <div className="wt-row-wrap">
        <span className="wt-label">Last backup</span>
        <span className="wt-mono">{backup === undefined ? "" : backup ? when : "None yet"}</span>
        <button type="button" className="wt-chip" onClick={() => invoke("show_backups_folder").catch((e) => setMessage(String(e)))}>Open folder</button>
        <button type="button" className="wt-chip" disabled={!backup} onClick={() => setConfirming(true)}>Restore …</button>
      </div>
      {confirming && backup && (
        <form className="wt-form wt-editor" role="alertdialog" aria-label="Restore" onKeyDown={(e) => e.key === "Escape" && setConfirming(false)} onSubmit={(e) => e.preventDefault()}>
          <span>
            Restore <b className="wt-mono">{backup.name}</b> from {when}? Work Tracker replaces your data with this copy and restarts. Changes after that time are lost.
          </span>
          <button type="button" className="wt-chip is-primary" onClick={() => invoke("restore_and_restart").catch((e) => (setMessage(String(e)), setConfirming(false)))}>Restore and restart</button>
          <button type="button" className="wt-chip" autoFocus onClick={() => setConfirming(false)}>Cancel</button>
        </form>
      )}
      <p className="wt-error" role="alert">{message}</p>
    </section>
  );
}
