import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { exportDays, exportRows } from "./exportRows";
import { Absence, absenceSpans } from "./schedule/absences";
import { expandMeetings, MeetingException, MeetingSeries } from "./schedule/meetings";
import { dateKey, dayBoundsIn, ymdIn } from "./schedule/schedule";
import type { Settings } from "./Settings";

type Category = { id: number; name: string };
const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
};

/** Pick a timeframe and write the Entries, Meetings and Absences in it to an Excel file. After a failure the dialog stays open. */
export function ExportDialog({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const today = dateKey(ymdIn(settings.tz, Date.now() / 1000));
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [path, setPath] = useState("");
  const [message, setMessage] = useState("");
  const problem = to < from ? "The end date must not be before the start date." : "";

  const choose = async () => (await save({ defaultPath: `work-tracker-${from}-${to}.xlsx`, filters: [{ name: "Excel", extensions: ["xlsx"] }] })) ?? "";
  const run = async (target: string) => {
    if (!target) return;
    setPath(target);
    setMessage("");
    try {
      const [fromUtc] = dayBoundsIn(settings.tz, parseDay(from));
      const [, toUtc] = dayBoundsIn(settings.tz, parseDay(to));
      const [entries, categories, locations, series, exceptions, absences] = await Promise.all([
        invoke<any[]>("list_entries", { fromUtc, toUtc }),
        invoke<Category[]>("list_categories"),
        invoke<{ date: string; location: string }[]>("list_workday_locations", { from, to }),
        invoke<MeetingSeries[]>("list_meetings"),
        invoke<MeetingException[]>("list_meeting_exceptions"),
        invoke<Absence[]>("list_absences"),
      ]);
      const meetings = expandMeetings(series, exceptions, fromUtc, toUtc);
      const inRange = absenceSpans(absences, settings.tz).map((s) => s.startUtc < toUtc && s.endUtc > fromUtc);
      const name = (id: number) => categories.find((c) => c.id === id)?.name ?? "Archived";
      await invoke("export_xlsx", { path: target, export: { rows: exportRows(entries, meetings, absences.filter((_, i) => inRange[i]), settings.tz, name), days: exportDays(locations) } });
      setMessage(`Saved ${target}`);
    } catch (e) {
      setMessage(String(e));
    }
  };
  const failed = !!path && !message.startsWith("Saved");

  return (
    <form
      className="wt-form wt-editor"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!problem) run(await choose());
      }}
    >
      <label className="wt-row"><span className="wt-label">From</span><input className="wt-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required /></label>
      <label className="wt-row"><span className="wt-label">To</span><input className="wt-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} required /></label>
      <button className="wt-chip is-primary" type="submit" disabled={!!problem}>Export</button>
      {failed && <button className="wt-chip" type="button" onClick={() => run(path)}>Try again</button>}
      {failed && <button className="wt-chip" type="button" onClick={async () => run(await choose())}>Choose another place</button>}
      <button className="wt-chip" type="button" onClick={onClose}>Close</button>
      <p className="wt-error" role="alert">{problem || message}</p>
    </form>
  );
}
