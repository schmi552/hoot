import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

type Category = { id: number; name: string };

export function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");

  const refresh = () => invoke<Category[]>("list_categories").then(setCategories);
  useEffect(() => void refresh(), []);

  const add = async () => {
    await invoke("add_category", { name });
    setName("");
    refresh();
  };

  return (
    <main>
      <h1>Work Tracker</h1>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={add} disabled={!name}>Add category</button>
      <ul>
        {categories.map((c) => (
          <li key={c.id}>{c.name}</li>
        ))}
      </ul>
    </main>
  );
}
