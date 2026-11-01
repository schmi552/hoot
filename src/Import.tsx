import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { type Category, CategoryCombo } from "./CategoryCombo";
import { type ImportedMeeting, parseIcs } from "./schedule/ics";
import type { MeetingSeries } from "./schedule/meetings";
import type { Settings } from "./Settings";

/**
 * Pick an `.ics` file and a Category for the whole import or for each Meeting, then save the Meetings. After a failure the dialog stays open.
 * `onDone` gets the ids of the new series that have no Category, so the caller can offer "Pick Category".
 */
export function ImportDialog({ settings, categories, onClose, onDone }: { settings: Settings; categories: Category[]; onClose: () => void; onDone: (uncategorized: number[]) => void }) {
  const [meetings, setMeetings] = useState<ImportedMeeting[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [all, setAll] = useState(0);
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
    invoke<number[]>("import_meetings", {
      meetings: meetings.map(({ exceptions, ...m }, i) => ({ series: { id: 0, categoryId: pick(i) || null, sourceFile: fileName, ...m }, exceptions: exceptions.map((x) => ({ seriesId: 0, ...x })) })),
    }).then((ids) => onDone(ids.filter((_, i) => !pick(i))), (e) => setMessage(String(e)));

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
            <div style={{ flex: 1 }}><CategoryCombo none options={categories} value={all} onChange={setAll} /></div>
          </label>
          <ul>
            {meetings.map((m, i) => (
              <li key={i}>
                {m.title} · {m.startLocal.replace("T", " ")}{m.rrule ? " · repeats" : ""}
                {perMeeting && (
                  <CategoryCombo none options={categories} value={pick(i)} onChange={(id) => setEach({ ...each, [i]: id })} />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {warnings.map((w) => <p key={w} className="wt-error">{w}</p>)}
      <button className="wt-chip" type="button" onClick={onClose}>Cancel</button>
      <button className="wt-chip is-primary" type="submit" disabled={!meetings.length}>Import {meetings.length || ""}</button>
      <p className="wt-error" role="alert">{message}</p>
    </form>
  );
}

/** Sets one Category on the Meetings of an import that came without one. */
export function PickCategoryDialog({ categories, series, onClose, onDone }: { categories: Category[]; series: MeetingSeries[]; onClose: () => void; onDone: () => void }) {
  const [id, setId] = useState(categories[0]?.id ?? 0);
  const [error, setError] = useState(categories.length ? "" : "Add a Category in Settings first.");
  const save = () =>
    Promise.all(series.map((m) => invoke("update_meeting", { meeting: { ...m, categoryId: id } }))).then(onDone, (e) => setError(String(e)));
  return (
    <div className="wt-modal">
      <form className="wt-form wt-editor" role="dialog" aria-modal="true" aria-label="Pick Category" onKeyDown={(e) => e.key === "Escape" && onClose()} onSubmit={(e) => (e.preventDefault(), id && save())}>
        <strong>Pick Category</strong>
        <div style={{ flex: 1 }}><CategoryCombo options={categories} value={id} onChange={setId} /></div>
        <button className="wt-chip" type="button" onClick={onClose}>Cancel</button>
        <button className="wt-chip is-primary" type="submit" disabled={!id}>Save</button>
        <p className="wt-error" role="alert">{error}</p>
      </form>
    </div>
  );
}
