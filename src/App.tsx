import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Calendar } from "./Calendar";
import { Onboarding } from "./Onboarding";
import { Settings, SettingsForm } from "./Settings";
import { Failure, SAMPLE_FAILURES, StartupScreen } from "./StartupScreen";

export function App() {
  const [failure, setFailure] = useState<Failure | null | undefined>(undefined);
  const checkStartup = () => invoke<Failure | null>("startup_failure").then(setFailure);
  useEffect(() => void checkStartup(), []);
  // Debug button: shows the next sample case. Its buttons never change real data.
  const [demo, setDemo] = useState<Failure | null>(null);
  const [demoCount, setDemoCount] = useState(0);
  const showDemo = () => (setDemo(SAMPLE_FAILURES[demoCount % SAMPLE_FAILURES.length]), setDemoCount(demoCount + 1));

  const [demoOnboarding, setDemoOnboarding] = useState(false);

  if (failure === undefined) return null;
  if (failure) return <StartupScreen failure={failure} onRecovered={checkStartup} />;
  if (demo) return <StartupScreen demo failure={demo} onRecovered={() => setDemo(null)} />;
  if (demoOnboarding) return <Onboarding demo onDone={() => setDemoOnboarding(false)} />;
  return <Tracker onDebugStartup={showDemo} onDebugOnboarding={() => setDemoOnboarding(true)} />;
}

/** Shows Onboarding until settings exist. Then the app, with Settings one click away. */
function Tracker({ onDebugStartup, onDebugOnboarding }: { onDebugStartup: () => void; onDebugOnboarding: () => void }) {
  const [settings, setSettings] = useState<Settings | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const load = () => invoke<Settings | null>("get_settings").then(setSettings);
  useEffect(() => void load(), []);

  if (settings === undefined) return null;
  if (settings === null) return <Onboarding onDone={load} />;
  if (editing)
    return (
      <SettingsForm
        saved={settings}
        onSaved={() => {
          setEditing(false);
          load();
        }}
        onBack={() => setEditing(false)}
      />
    );
  return <Calendar settings={settings} onSettings={() => setEditing(true)} onDebugStartup={onDebugStartup} onDebugOnboarding={onDebugOnboarding} />;
}
