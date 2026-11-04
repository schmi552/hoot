import type { ReactNode } from "react";
import { ErrorLine } from "./Popup";

export type EventKind = "Meeting" | "Absence";
const KINDS: EventKind[] = ["Meeting", "Absence"];

/** A modal form: a header with the title, a body for the fields and a footer with Cancel and Save. The Meeting form and the Absence form both use it. */
export function FormDialog({ title, onClose, onSubmit, error, retry, extra, kind, onKind, children }: {
  title: string; onClose: () => void; onSubmit: () => void; error: string; retry?: () => void; extra?: ReactNode;
  /** The kind of event the form is for. With `onKind` the header offers a switch between the two kinds. */
  kind?: EventKind; onKind?: (kind: EventKind) => void; children: ReactNode;
}) {
  return (
    <div className="wt-modal">
      <form
        className="wt-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <header className="wt-dialog-head">
          {title}
          {kind && onKind && (
            <div role="group" aria-label="Kind" className="wt-segmented">
              {KINDS.map((k) => <button key={k} type="button" className="wt-chip" aria-pressed={k === kind} onClick={() => k !== kind && onKind(k)}>{k}</button>)}
            </div>
          )}
        </header>
        <div className="wt-dialog-body">
          {children}
          <ErrorLine error={error} retry={retry} />
        </div>
        <footer className="wt-dialog-foot">
          {extra}
          <button className="wt-chip" type="button" onClick={onClose}>Cancel</button>
          <button className="wt-chip is-primary" type="submit">Save</button>
        </footer>
      </form>
    </div>
  );
}

/** A label above one control. */
export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="wt-field"><span className="wt-label">{label}</span>{children}</label>
);
