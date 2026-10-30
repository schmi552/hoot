import { expect, test } from "vitest";
import { parseIcs } from "./ics";
import { expandMeetings } from "./meetings";
import { instantAt } from "./schedule";

const cal = (...events: string[]) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...events.map((e) => `BEGIN:VEVENT\r\n${e}\r\nEND:VEVENT`), "END:VCALENDAR"].join("\r\n");
const weekly = [
  "UID:w1", "SUMMARY:Standup", "DTSTART;TZID=Europe/Berlin:20260323T100000", "DTEND;TZID=Europe/Berlin:20260323T103000",
  "RRULE:FREQ=WEEKLY;COUNT=5", "EXDATE;TZID=Europe/Berlin:20260330T100000",
].join("\r\n");
const moved = ["UID:w1", "RECURRENCE-ID;TZID=Europe/Berlin:20260406T100000", "SUMMARY:Standup (moved)", "DTSTART;TZID=Europe/Berlin:20260406T140000", "DTEND;TZID=Europe/Berlin:20260406T150000"].join("\r\n");

test("a weekly event keeps its RRULE, its cancelled date as a skip and its changed occurrence as an override", () => {
  const { meetings, warnings } = parseIcs(cal(weekly, moved), "Europe/Berlin");
  expect(warnings).toEqual([]);
  expect(meetings).toEqual([{
    title: "Standup", startLocal: "2026-03-23T10:00", durationMinutes: 30, tz: "Europe/Berlin", rrule: "FREQ=WEEKLY;COUNT=5",
    exceptions: [
      { originalStartLocal: "2026-03-30T10:00", kind: "skip", startLocal: null, durationMinutes: null, title: null, categoryId: null },
      { originalStartLocal: "2026-04-06T10:00", kind: "override", startLocal: "2026-04-06T14:00", durationMinutes: 60, title: "Standup (moved)", categoryId: null },
    ],
  }]);
});

test("the parsed series expands with the skip and the override applied", () => {
  const [m] = parseIcs(cal(weekly, moved), "Europe/Berlin").meetings;
  const series = { id: 1, categoryId: 1, ...m };
  const occ = expandMeetings([series], m.exceptions.map((x) => ({ ...x, seriesId: 1 })), instantAt("Europe/Berlin", { y: 2026, m: 3, d: 23 }, 0), instantAt("Europe/Berlin", { y: 2026, m: 4, d: 14 }, 0));
  expect(occ.map((o) => o.title)).toEqual(["Standup", "Standup (moved)", "Standup"]); // 23 March, 6 April moved, 13 April
});

test("a cancelled occurrence in the file becomes a skip", () => {
  const cancelled = ["UID:w1", "RECURRENCE-ID;TZID=Europe/Berlin:20260406T100000", "STATUS:CANCELLED", "SUMMARY:Standup", "DTSTART;TZID=Europe/Berlin:20260406T100000", "DTEND;TZID=Europe/Berlin:20260406T103000"].join("\r\n");
  const [m] = parseIcs(cal(weekly, cancelled), "Europe/Berlin").meetings;
  expect(m.exceptions.map((x) => [x.originalStartLocal, x.kind])).toEqual([["2026-03-30T10:00", "skip"], ["2026-04-06T10:00", "skip"]]);
});

test("a Windows zone name maps to IANA, with or without a VTIMEZONE", () => {
  const ev = ["UID:a", "SUMMARY:Sync", "DTSTART;TZID=W. Europe Standard Time:20260323T100000", "DTEND;TZID=W. Europe Standard Time:20260323T110000"].join("\r\n");
  const { meetings, warnings } = parseIcs(cal(ev), "America/New_York");
  expect(warnings).toEqual([]);
  expect([meetings[0].tz, meetings[0].startLocal, meetings[0].durationMinutes]).toEqual(["Europe/Berlin", "2026-03-23T10:00", 60]);
});

test("an unknown TZID is read as local time and warns once", () => {
  const ev = (n: number) => ["UID:u" + n, "SUMMARY:X", "DTSTART;TZID=Customized Zone:20260323T100000", "DTEND;TZID=Customized Zone:20260323T110000"].join("\r\n");
  const { meetings, warnings } = parseIcs(cal(ev(1), ev(2)), "Europe/Berlin");
  expect(meetings.map((m) => m.tz)).toEqual(["Europe/Berlin", "Europe/Berlin"]);
  expect(warnings).toEqual(['Unknown time zone "Customized Zone": its times are read as local time.']);
});

test("a UTC time keeps the zone UTC, a floating time is local", () => {
  const utc = ["UID:a", "SUMMARY:A", "DTSTART:20260323T090000Z", "DTEND:20260323T093000Z"].join("\r\n");
  const floating = ["UID:b", "SUMMARY:B", "DTSTART:20260323T090000", "DURATION:PT45M"].join("\r\n");
  const { meetings } = parseIcs(cal(utc, floating), "Europe/Berlin");
  expect(meetings.map((m) => [m.tz, m.startLocal, m.durationMinutes])).toEqual([["UTC", "2026-03-23T09:00", 30], ["Europe/Berlin", "2026-03-23T09:00", 45]]);
});

test("all-day events are skipped with a warning", () => {
  const ev = ["UID:a", "SUMMARY:Holiday", "DTSTART;VALUE=DATE:20260323", "DTEND;VALUE=DATE:20260324"].join("\r\n");
  expect(parseIcs(cal(ev), "Europe/Berlin")).toEqual({ meetings: [], warnings: ["1 all-day event was skipped."] });
});

test("an override on a day that is also an EXDATE wins, and an UNTIL ends the series", () => {
  const ev = ["UID:a", "SUMMARY:S", "DTSTART;TZID=Europe/Berlin:20260323T100000", "DTEND;TZID=Europe/Berlin:20260323T103000", "RRULE:FREQ=DAILY;UNTIL=20260325T120000Z", "EXDATE;TZID=Europe/Berlin:20260324T100000"].join("\r\n");
  const over = ["UID:a", "RECURRENCE-ID;TZID=Europe/Berlin:20260324T100000", "SUMMARY:S2", "DTSTART;TZID=Europe/Berlin:20260324T110000", "DTEND;TZID=Europe/Berlin:20260324T113000"].join("\r\n");
  const [m] = parseIcs(cal(ev, over), "Europe/Berlin").meetings;
  expect(m.exceptions.map((x) => x.kind)).toEqual(["override"]);
  const occ = expandMeetings([{ id: 1, categoryId: 1, ...m }], m.exceptions.map((x) => ({ ...x, seriesId: 1 })), instantAt("Europe/Berlin", { y: 2026, m: 3, d: 23 }, 0), instantAt("Europe/Berlin", { y: 2026, m: 3, d: 30 }, 0));
  expect(occ.map((o) => o.title)).toEqual(["S", "S2", "S"]); // 23, 24 (moved), 25; the series ends after the 25th
});
