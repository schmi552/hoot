import { KeyboardEvent, useEffect, useId, useState } from "react";

export type Category = { id: number; code: string; name: string; color: number };
const NONE: Category = { id: 0, code: "", name: "No Category", color: 1 };

/** A Category field that holds the chosen Category: "code name" with a color dot. Its list opens upward. With `none` the list starts with "No Category" (id 0). */
export function CategoryCombo({ options, value, onChange, none }: { options: Category[]; value: number; onChange: (id: number) => void; none?: boolean }) {
  const label = (o: Category) => (o.code ? `${o.code} ${o.name}` : o.name);
  const all = none ? [NONE, ...options] : options;
  const chosen = all.find((o) => o.id === value);
  const name = chosen ? label(chosen) : "";
  const id = useId();
  const [text, setText] = useState(name);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => setText(name), [name]);
  const shown = text === name ? all : all.filter((o) => label(o).toLowerCase().includes(text.toLowerCase()));
  const pick = (o: Category) => { onChange(o.id); setText(label(o)); setOpen(false); };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (open) setActive((a) => Math.min(Math.max(a + (e.key === "ArrowDown" ? 1 : -1), 0), shown.length - 1));
      else setActive(Math.max(shown.findIndex((o) => o.id === value), 0)); // opening shows the current value
    } else if (open && e.key === "Enter" && shown[active]) { e.stopPropagation(); pick(shown[active]); }
    else if (open && e.key === "Escape") { e.stopPropagation(); setOpen(false); setText(name); }
  };
  return (
    <div className="wt-combo">
      <input className="wt-input" role="combobox" aria-label="Category" aria-expanded={open} aria-controls={id} aria-autocomplete="list" placeholder={none ? "No Category" : "Category (type to filter)"}
        value={text} onChange={(e) => { setText(e.target.value); setActive(0); setOpen(true); }} onBlur={() => { setOpen(false); setText(name); }} onKeyDown={onKeyDown} />
      {open && shown.length > 0 && (
        <ul id={id} role="listbox">
          {shown.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === active} className={i === active ? "is-active" : ""} onMouseDown={(e) => { e.preventDefault(); pick(o); }}><span className={o.id ? "wt-dot" : "wt-dot is-empty"} style={{ "--dot": `var(--cat-${o.color}-solid)` } as React.CSSProperties} />{label(o)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
