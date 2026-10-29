import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

export type Failure =
  | { kind: "migration"; from: number; to: number; error: string }
  | { kind: "tooNew"; found: number; supported: number }
  | { kind: "corrupt"; error: string; latestBackup: string | null };

const details = (f: Failure) => JSON.stringify(f, null, 2);

/** Shown instead of the app when the database did not open. `onRecovered` runs after Restore or Start empty. */
export function StartupScreen({ failure, onRecovered }: { failure: Failure; onRecovered: () => void }) {
  const [message, setMessage] = useState("");
  const [restoredDays, setRestoredDays] = useState<number | null>(null);
  const fail = (e: unknown) => setMessage(String(e));
  const restore = () =>
    invoke<number>("restore_latest_backup").then(setRestoredDays, fail);
  const startEmpty = () => invoke("start_empty").then(onRecovered, fail);

  if (restoredDays !== null)
    return (
      <main className="wt-startup" role="status">
        <h1>Backup restored</h1>
        <p>Up to {restoredDays} day(s) of data may be missing.</p>
        <button className="wt-chip is-primary" onClick={onRecovered}>Continue</button>
      </main>
    );

  return (
    <main className="wt-startup" role="alert">
      {failure.kind === "migration" && (
        <>
          <h1>The update of your data failed</h1>
          <p>Your data is unchanged. Update the app, or ask for help with the details below.</p>
          <p>Data version {failure.from}, app needs version {failure.to}.</p>
          <pre>{failure.error}</pre>
        </>
      )}
      {failure.kind === "tooNew" && (
        <>
          <h1>Your data is from a newer app</h1>
          <p>
            The data has version {failure.found}. This app supports up to version {failure.supported}. Install the
            newest app. The app did not change your data.
          </p>
        </>
      )}
      {failure.kind === "corrupt" && (
        <>
          <h1>Your database is damaged</h1>
          <p>The app did not delete or repair the file. Both options below keep it as a renamed copy.</p>
          <pre>{failure.error}</pre>
          <div className="wt-startup-actions">
            {failure.latestBackup && (
              <button className="wt-chip is-primary" onClick={restore}>
                Restore latest backup ({failure.latestBackup})
              </button>
            )}
            <button className="wt-chip" onClick={startEmpty}>Start empty</button>
          </div>
        </>
      )}
      <p className="wt-error">{message}</p>
      <div className="wt-startup-actions">
        {failure.kind !== "tooNew" && (
          <button className="wt-chip" onClick={() => navigator.clipboard.writeText(details(failure))}>Copy details</button>
        )}
        <button className="wt-chip" onClick={() => invoke("show_backups_folder")}>Show backups folder</button>
        <button className="wt-chip" onClick={() => invoke("quit")}>Quit</button>
      </div>
    </main>
  );
}
