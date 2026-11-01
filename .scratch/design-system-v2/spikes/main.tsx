import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import classicTheme from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
import "../docs/design-system/tokens.css";
import "../docs/design-system/components.css";
import "./spikes.css";
import { useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";

const w = window as any;
w.__mirror = [];
const tz = "Europe/Zurich";
const ev = (id: string, s: string, e: string, extra = {}) => ({ id, title: id, start: s + "+02:00", end: e + "+02:00", ...extra });
const events = [
  ev("A", "2026-10-26T09:00:00", "2026-10-26T10:00:00", { className: "spike-evt" }),
  ev("B", "2026-10-26T17:00:00", "2026-10-26T18:00:00", { className: "spike-single" }),
  ev("C", "2026-10-27T09:00:00", "2026-10-27T09:15:00"),
  ev("D", "2026-10-28T10:00:00", "2026-10-28T11:00:00"),
];

function Spikes() {
  const [cells, setCells] = useState<Record<string, Element>>({});
  return (
    <>
      <div className="wt-calendar" id="week">
        <FullCalendar
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, classicTheme]}
          timeZone={tz}
          initialView="timeGridWeek"
          initialDate="2026-10-26"
          headerToolbar={false}
          firstDay={1}
          height="auto"
          slotDuration={{ minutes: 30 }}
          slotMinHeight={32}
          snapDuration="00:15:00"
          slotHeaderInterval="01:00"
          editable
          events={events}
          columnEventClass={(i) => (i.isDragging && !i.isMirror ? "spike-source" : "")}
          eventContent={(i) => {
            if (i.isMirror) w.__mirror.push({ s: i.event.start?.toISOString(), e: i.event.end?.toISOString(), drag: i.isDragging, resize: i.isResizing, timeText: i.timeText });
            return <div className="spike-child">{i.event.title}</div>;
          }}
        />
      </div>
      <div className="wt-calendar" id="month">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin, classicTheme]}
          timeZone={tz}
          initialView="dayGridMonth"
          initialDate="2026-10-01"
          headerToolbar={false}
          firstDay={1}
          height="auto"
          dayCellClass="spike-cell"
          dayCellDidMount={(i) => setCells((c) => ({ ...c, [i.date.toISOString()]: i.el.lastElementChild! }))}
        />
        {Object.entries(cells).map(([k, el]) => createPortal(<div className="spike-portal">P</div>, el, k))}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Spikes />);
