import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { exportDays, exportFileName, exportPresets, exportRows, formatDmy, parseDmy } from "./exportRows";
import type { Absence } from "./schedule/absences";
import { expandMeetings, MeetingException, MeetingSeries } from "./schedule/meetings";
import { dateKey, dayBoundsIn, ymdIn } from "./schedule/schedule";
import type { Settings } from "./Settings";

type Category = { id: number; code: string; name: string };
const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
};

/** Pick a timeframe and write the Entries, Meetings and Absences in it to an Excel file. After a failure the dialog stays open. */
export function ExportDialog({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const today = dateKey(ymdIn(settings.tz, Date.now() / 1000));
  const presets = exportPresets(today);
  const [from, setFrom] = useState(formatDmy(presets["This month"].from));
  const [to, setTo] = useState(formatDmy(presets["This month"].to));
  const [path, setPath] = useState("");
  const [done, setDone] = useState<{ path: string; count: number } | null>(null);
  const [message, setMessage] = useState("");
  const fromDay = parseDmy(from);
  const toDay = parseDmy(to);
  const problem = !fromDay || !toDay ? "Write dates as dd.mm.yyyy." : toDay < fromDay ? "The end date must not be before the start date." : "";

  const choose = async () =>
    (await save({ defaultPath: exportFileName(fromDay!, toDay!), filters: [{ name: "Excel", extensions: ["xlsx"] }] })) ?? "";
  const run = async (target: string) => {
    if (!target || !fromDay || !toDay) return;
    setPath(target);
    setMessage("");
    setDone(null);
    try {
      const [fromUtc] = dayBoundsIn(settings.tz, parseDay(fromDay));
      const [, toUtc] = dayBoundsIn(settings.tz, parseDay(toDay));
      const [entries, categories, locations, series, exceptions, absences] = await Promise.all([
        invoke<any[]>("list_entries", { fromUtc, toUtc }),
        invoke<Category[]>("list_categories"),
        invoke<{ date: string; location: string }[]>("list_workday_locations", { from: fromDay, to: toDay }),
        invoke<MeetingSeries[]>("list_meetings"),
        invoke<MeetingException[]>("list_meeting_exceptions"),
        invoke<Absence[]>("list_absences"),
      ]);
      const meetings = expandMeetings(series, exceptions, fromUtc, toUtc);
      const category = (id: number) => {
        const c = categories.find((c) => c.id === id);
        return { code: c?.code ?? "", name: c?.name ?? "Archived" };
      };
      await invoke("export_xlsx", { path: target, export: { rows: exportRows(entries, meetings, absences, settings.tz, { from: fromDay, to: toDay }, category), days: exportDays(locations) } });
      setDone({ path: target, count: entries.length + meetings.length });
    } catch (e) {
      setMessage(String(e));
    }
  };

  return (
    <div className="wt-modal">
      <form
        className="wt-form wt-editor"
        style={{ width: 440 }}
        role="dialog"
        aria-modal="true"
        aria-label="Export to Excel"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!problem) run(await choose());
        }}
      >
        <strong style={{ flexBasis: "100%" }}>Export to Excel</strong>
        <div style={{ flexBasis: "100%" }}>
          {Object.entries(presets).map(([name, r]) => (
            <button key={name} className="wt-chip" type="button" aria-pressed={fromDay === r.from && toDay === r.to} onClick={() => (setFrom(formatDmy(r.from)), setTo(formatDmy(r.to)))}>{name}</button>
          ))}
        </div>
        <label className="wt-row"><span className="wt-label">From</span><input className="wt-input wt-mono" inputMode="numeric" placeholder="dd.mm.yyyy" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={!fromDay} /></label>
        <label className="wt-row"><span className="wt-label">To</span><input className="wt-input wt-mono" inputMode="numeric" placeholder="dd.mm.yyyy" value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={!toDay} /></label>
        <span className="wt-hint" style={{ flexBasis: "100%" }}>Two sheets: Entries, and a summary per Category and day.</span>
        <button className="wt-chip" type="button" onClick={onClose}>{done ? "Close" : "Cancel"}</button>
        <button className="wt-chip is-primary" type="submit" disabled={!!problem}>Export .xlsx</button>
        {message && <button className="wt-chip" type="button" onClick={() => run(path)}>Try again</button>}
        {message && <button className="wt-chip" type="button" onClick={async () => run(await choose())}>Choose another place</button>}
        {done && (
          <div className="wt-notice is-success wt-notice-row" role="status" style={{ flexBasis: "100%" }}>
            <span><b>Exported {done.count} {done.count === 1 ? "Entry" : "Entries"}.</b> {done.path.split(/[\\/]/).pop()}</span>
            <button className="wt-chip" type="button" onClick={() => invoke("show_in_folder", { path: done.path }).catch((e) => setMessage(String(e)))}>Show in folder</button>
          </div>
        )}
        <p className="wt-error" role="alert">{problem || message}</p>
      </form>
    </div>
  );
}
