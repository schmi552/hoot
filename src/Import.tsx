import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { type ImportedMeeting, parseIcs } from "./schedule/ics";
import type { Settings } from "./Settings";

type Category = { id: number; name: string };

/** Pick an `.ics` file and a Category for the whole import or for each Meeting, then save the Meetings. After a failure the dialog stays open. */
export function ImportDialog({ settings, categories, onClose, onDone }: { settings: Settings; categories: Category[]; onClose: () => void; onDone: () => void }) {
  const [meetings, setMeetings] = useState<ImportedMeeting[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [all, setAll] = useState(categories[0]?.id ?? 0);
  const [each, setEach] = useState<Record<number, number>>({}); // by index; set only in "each" mode
  const [perMeeting, setPerMeeting] = useState(false);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const pick = (i: number) => (perMeeting ? each[i] ?? all : all);

  const read = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseIcs(await file.text(), settings.tz);
      setFileName(file.name);
      setMeetings(parsed.meetings);
      setWarnings(parsed.warnings);
      setEach({});
      setMessage(parsed.meetings.length ? "" : "The file has no Meetings to import.");
    } catch {
      setMeetings([]);
      setWarnings([]);
      setMessage("This file is not a valid .ics file.");
    }
  };
  const save = () =>
    invoke("import_meetings", {
      meetings: meetings.map(({ exceptions, ...m }, i) => ({ series: { id: 0, categoryId: pick(i) || null, sourceFile: fileName, ...m }, exceptions: exceptions.map((x) => ({ seriesId: 0, ...x })) })),
    }).then(onDone, (e) => setMessage(String(e)));

  return (
    <form
      className="wt-form wt-editor"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      onSubmit={(e) => {
        e.preventDefault();
        if (meetings.length) save();
      }}
    >
      <label className="wt-row"><span className="wt-label">File</span><input className="wt-input" type="file" accept=".ics,text/calendar" onChange={(e) => read(e.target.files?.[0])} /></label>
      {meetings.length > 0 && (
        <>
          <label className="wt-row"><span className="wt-label">Category per Meeting</span><input type="checkbox" checked={perMeeting} onChange={(e) => setPerMeeting(e.target.checked)} /></label>
          <label className="wt-row">
            <span className="wt-label">{perMeeting ? "Default Category" : "Category"}</span>
            <select className="wt-input" value={all} onChange={(e) => setAll(Number(e.target.value))}><option value={0}>No Category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
          <ul>
            {meetings.map((m, i) => (
              <li key={i}>
                {m.title} · {m.startLocal.replace("T", " ")}{m.rrule ? " · repeats" : ""}
                {perMeeting && (
                  <select aria-label={`Category of ${m.title}`} className="wt-input" value={pick(i)} onChange={(e) => setEach({ ...each, [i]: Number(e.target.value) })}>
                    <option value={0}>No Category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {warnings.map((w) => <p key={w} className="wt-error">{w}</p>)}
      <button className="wt-chip is-primary" type="submit" disabled={!meetings.length}>Import {meetings.length || ""}</button>
      <button className="wt-chip" type="button" onClick={onClose}>Close</button>
      <p className="wt-error" role="alert">{message}</p>
    </form>
  );
}
