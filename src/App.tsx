import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Settings, SettingsForm } from "./Settings";
import { Failure, StartupScreen } from "./StartupScreen";

export function App() {
  const [failure, setFailure] = useState<Failure | null | undefined>(undefined);
  const checkStartup = () => invoke<Failure | null>("startup_failure").then(setFailure);
  useEffect(() => void checkStartup(), []);

  if (failure === undefined) return null;
  if (failure) return <StartupScreen failure={failure} onRecovered={checkStartup} />;
  return <Tracker />;
}

/** Shows the setup form until settings exist. Then the app, with Settings one click away. */
function Tracker() {
  const [settings, setSettings] = useState<Settings | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const load = () => invoke<Settings | null>("get_settings").then(setSettings);
  useEffect(() => void load(), []);

  if (settings === undefined) return null;
  if (settings === null || editing)
    return (
      <SettingsForm
        saved={settings}
        onSaved={() => {
          setEditing(false);
          load();
        }}
      />
    );
  return (
    <main>
      <h1>Work Tracker</h1>
      <button className="wt-chip" onClick={() => setEditing(true)}>Settings</button>
    </main>
  );
}
