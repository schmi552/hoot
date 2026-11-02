import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { Hoot } from "./Hoot";

export type Failure =
  | { kind: "migration"; from: number; to: number; error: string }
  | { kind: "tooNew"; found: number; supported: number }
  | { kind: "corrupt"; error: string; latestBackup: string | null };

/** The three cases with sample data, for the debug button. */
export const SAMPLE_FAILURES: Failure[] = [
  { kind: "corrupt", error: "quick_check: row 412 missing from index entries_by_day", latestBackup: "2026-10-28" },
  { kind: "migration", from: 3, to: 4, error: "migration 4: no such column entries.code" },
  { kind: "tooNew", found: 99, supported: 4 },
];

const details = (f: Failure) => JSON.stringify(f, null, 2);

/** "2026-10-28" becomes "28 Oct". */
const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`;
};

/**
 * Shown instead of the app when the database did not open. `onRecovered` runs after Restore or Start empty.
 * With `demo`, the buttons that change data or quit only close the screen.
 */
export function StartupScreen({ failure, onRecovered, demo }: { failure: Failure; onRecovered: () => void; demo?: boolean }) {
  const [message, setMessage] = useState("");
  const [restoredDays, setRestoredDays] = useState<number | null>(null);
  const fail = (e: unknown) => setMessage(String(e));
  const restore = () => (demo ? onRecovered() : invoke<number>("restore_latest_backup").then(setRestoredDays, fail));
  const startEmpty = () => (demo ? onRecovered() : invoke("start_empty").then(onRecovered, fail));
  const quit = () => (demo ? onRecovered() : invoke("quit"));

  if (restoredDays !== null)
    return (
      <div className="wt-startup-page">
      <main className="wt-startup" role="status">
        <header className="wt-startup-head">
          <Hoot px={5} mood="saved" />
          <h1>Your backup is back.</h1>
        </header>
        <p>Up to {restoredDays} day(s) of data may be missing.</p>
        <div className="wt-startup-actions">
          <button className="wt-chip is-primary" onClick={onRecovered}>Continue</button>
        </div>
      </main>
      </div>
    );

  const text = {
    corrupt: { title: "My notebook has a problem.", body: "The database did not pass its check. Your data is not changed. Pick what to do." },
    migration: {
      title: "I could not update my notebook.",
      body:
        failure.kind === "migration"
          ? `Your data is not changed. It has version ${failure.from}, and this app needs version ${failure.to}. Update the app, or ask for help with the details below.`
          : "",
    },
    tooNew: {
      title: "This notebook is from a newer app.",
      body:
        failure.kind === "tooNew"
          ? `The data has version ${failure.found}. This app supports up to version ${failure.supported}. Install the newest app. I did not change your data.`
          : "",
    },
  }[failure.kind];

  return (
    <div className="wt-startup-page">
    <main className="wt-startup" role="alert">
      <header className="wt-startup-head">
        <Hoot px={5} mood="problem" />
        <h1>{text.title}</h1>
      </header>
      <p>{text.body}</p>
      {failure.kind !== "tooNew" && <pre>{failure.error}</pre>}
      <p className="wt-error">{message}</p>
      <div className="wt-startup-actions">
        {failure.kind === "corrupt" && (
          <>
            <button className="wt-chip is-primary" disabled={!failure.latestBackup} onClick={restore}>
              {failure.latestBackup ? `Restore backup of ${shortDate(failure.latestBackup)}` : "No backup to restore"}
            </button>
            <button className="wt-chip is-danger" onClick={startEmpty}>Start empty</button>
          </>
        )}
        <button className="wt-chip" onClick={quit}>Quit</button>
        {failure.kind !== "tooNew" && (
          <button className="wt-chip" onClick={() => navigator.clipboard.writeText(details(failure))}>Copy details</button>
        )}
        <button className="wt-chip" onClick={() => invoke("show_backups_folder")}>Show backups folder</button>
      </div>
    </main>
    </div>
  );
}
