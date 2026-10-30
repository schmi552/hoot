import { expect, test } from "vitest";
import { expandMeetings, ruleFor, type MeetingSeries } from "./meetings";
import { instantAt } from "./schedule";
import { gapDue, popupDue, subtractSpans } from "./schedule";

const series = (over: Partial<MeetingSeries> = {}): MeetingSeries => ({
  id: 1, categoryId: 1, title: "Standup", startLocal: "2026-03-23T10:00", durationMinutes: 30, tz: "Europe/Berlin", rrule: null, ...over,
});
const at = (day: number, hm: number, month = 3) => instantAt("Europe/Berlin", { y: 2026, m: month, d: day }, hm);

test("a one-off Meeting shows only in a range that touches it", () => {
  const [m] = expandMeetings([series()], at(23, 0), at(24, 0));
  expect([m.startUtc, m.endUtc, m.title]).toEqual([at(23, 600), at(23, 630), "Standup"]);
  expect(expandMeetings([series()], at(24, 0), at(25, 0))).toEqual([]);
});

test("the repeat choices expand to the right days", () => {
  const week = [at(23, 0), at(30, 0)] as const; // Mon 23 to Mon 30 March
  const days = (repeat: Parameters<typeof ruleFor>[0]) =>
    expandMeetings([series({ rrule: ruleFor(repeat) })], ...week).map((o) => new Date(o.startUtc * 1000).getUTCDate());
  expect(days("daily")).toHaveLength(7);
  expect(days("weekdays")).toHaveLength(5);
  expect(days("weekly")).toHaveLength(1);
  expect(expandMeetings([series({ rrule: ruleFor("monthly") })], at(1, 0, 4), at(30, 0, 4))).toHaveLength(1); // 23 April
});

test("a Meeting stays at 10:00 local across the DST change", () => {
  // Europe/Berlin changes to summer time on Sunday 29 March 2026.
  const occ = expandMeetings([series({ rrule: ruleFor("daily") })], at(27, 0), at(31, 0));
  expect(occ.map((o) => o.startUtc)).toEqual([at(27, 600), at(28, 600), at(29, 600), at(30, 600)]);
  expect(occ[2].startUtc - occ[1].startUtc).toBe(23 * 3600);
});

test("a Meeting that began before the range and runs into it is found", () => {
  expect(expandMeetings([series({ durationMinutes: 120 })], at(23, 660), at(24, 0))).toHaveLength(1); // range starts 11:00, Meeting 10:00-12:00
});

test("a weekly Meeting stays at 10:00 local across the autumn DST change", () => {
  // Europe/Berlin changes back on Sunday 25 October 2026.
  const occ = expandMeetings([series({ startLocal: "2026-10-19T10:00", rrule: ruleFor("weekly") })], at(19, 0, 10), at(27, 0, 10));
  expect(occ.map((o) => o.startUtc)).toEqual([at(19, 600, 10), at(26, 600, 10)]);
});

test("subtractSpans cuts Meetings out of a span", () => {
  expect(subtractSpans([{ startUtc: 0, endUtc: 100 }], [{ startUtc: 20, endUtc: 30 }, { startUtc: 90, endUtc: 200 }])).toEqual([
    { startUtc: 0, endUtc: 20 }, { startUtc: 30, endUtc: 90 },
  ]);
});

const s = { workStart: "09:00", workEnd: "17:00", lunchStart: "12:00", lunchEnd: "13:00", tz: "Europe/Berlin", intervalMinutes: 60 };

test("no popup shows during a Meeting and the popup span skips it", () => {
  const meeting = [{ startUtc: at(23, 600), endUtc: at(23, 660) }]; // 10:00-11:00
  expect(popupDue(s, at(23, 630), [], 0, meeting)).toBeNull();
  const spans = popupDue(s, at(23, 720 - 1), [], 0, meeting)!; // 11:59
  expect(spans.map((p) => [p.startUtc, p.endUtc])).toEqual([[at(23, 540), at(23, 600)], [at(23, 660), at(23, 719)]]);
});

test("a Gap leaves Meetings out", () => {
  const meeting = [{ startUtc: at(23, 540), endUtc: at(23, 660) }]; // 09:00-11:00
  expect(gapDue(s, at(23, 700), [], 0, meeting)).toBeNull(); // only 11:00-11:40 is left
});
