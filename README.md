<div align="center">

<img src="docs/assets/hoot.svg" alt="Hoot, the pixel owl" width="144" height="144" />

# Hoot

**A small owl that keeps your work log.**
Every half hour it asks what you did. You answer in one line. Your week fills itself.

<br />

![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB?style=for-the-badge&logo=tauri&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-backend-000000?style=for-the-badge&logo=rust&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-local-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

![Platforms](https://img.shields.io/badge/macOS%20%C2%B7%20Windows-supported-5b7a8c?style=flat-square)
![Offline](https://img.shields.io/badge/data-stays%20on%20your%20computer-f0a83a?style=flat-square)
![Status](https://img.shields.io/badge/status-early%20(v0.1)-9db5c2?style=flat-square)

</div>

<br />

<div align="center">
  <img src="docs/screenshots/week-light.jpg" alt="The week view of Hoot in light mode" width="92%" />
</div>

---

## ✨ What is Hoot?

Hoot is a desktop app for one person who wants to know what they did at work, without a spreadsheet and without a stopwatch.

It starts when you log in and sits in your menu bar or tray. At the interval you choose, a small window opens and asks one question: *"What did you do since 09:05?"* You pick a recent answer or type a new one, pick a Category, and press Enter. The window closes. Hoot puts the time block in your calendar.

At the end of the week or the month, you export the hours to Excel.

> The idea: logging should take about five seconds, so that you really do it.

---

## 🦉 Features

| | |
|---|---|
| ⏰ **Check-in popup** | A small always-on-top window asks every 15, 30, 45 or 60 minutes. Quick replies from your recent answers. **Yes, still** repeats the last Entry with one key. |
| 🗓️ **Week and Month calendar** | Drag to add an Entry. Drag the edge to resize. Move Entries with the keyboard. Undo and redo. Hours per day, hours per week, and a share-per-Category bar. |
| 🏷️ **Categories** | A code (for example a PSP number), a name and one of eight colors. A Category that has Entries is archived, not deleted. |
| 🔁 **Recurring Meetings** | Add a Meeting by hand, or import an `.ics` file. Change one day or the whole series. |
| 🏖️ **Absences** | Vacation, sick days and other time away, for whole days or part of a day. Expected hours adjust. |
| 🏠 **Home or Office** | Hoot asks once a day where you work, and shows it in the calendar. |
| 📊 **Excel export** | One file with two sheets: every Entry, and the hours per Category and day. Pick a month or any range. |
| 🛟 **Backups and recovery** | One backup copy per day, the last seven are kept. If the database is damaged, Hoot opens a recovery screen and can restore the newest backup. |
| 🌗 **Light and dark** | Follows the system, or you choose. |
| 🔒 **Private by design** | No account. No cloud. The data lives in a SQLite file on your computer. |

<br />

<div align="center">
  <img src="docs/screenshots/popup-light.png" alt="The Hoot check-in popup" width="340" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/week-dark.jpg" alt="The week view in dark mode" width="520" />
</div>

---

## 📸 A look around

<table>
  <tr>
    <td width="50%"><b>Month view</b><br /><img src="docs/screenshots/month-light.jpg" alt="Month view with totals and a Week column" /></td>
    <td width="50%"><b>Settings (dark)</b><br /><img src="docs/screenshots/settings-dark.jpg" alt="Settings with Categories, Meetings and appearance" /></td>
  </tr>
  <tr>
    <td colspan="2"><b>First start</b><br /><img src="docs/screenshots/onboarding-light.jpg" alt="Onboarding: work hours, lunch, Categories and interval" /></td>
  </tr>
</table>

---

## 📦 Install

There are no download files yet. Build Hoot from the source code. It takes a few minutes the first time.

**You need**

- [Node.js](https://nodejs.org) 22 or newer
- [Rust](https://rustup.rs) (stable)
- The system tools that Tauri needs. Follow the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your system (Xcode command line tools on macOS, the WebView2 runtime and C++ build tools on Windows).

**Build**

```bash
git clone https://github.com/schmi552/hoot.git
cd hoot
npm install
npm run tauri build
```

The installer is in `src-tauri/target/release/bundle/`. On macOS you get a `.app` and a `.dmg`. On Windows you get an `.msi` and an `.exe` installer.

**First start**

Hoot asks four short questions: your work hours, your lunch break, your Categories (optional) and how often it should ask. You can change all of them later in Settings. The check-in then starts on its own, and Hoot can open when you log in.

> **macOS:** Hoot has no Dock icon. Look for the owl in the menu bar.

---

## 🧰 Tech stack

| Layer | What we use |
|---|---|
| App shell | [Tauri 2](https://tauri.app): small installer, native window, tray, notifications, autostart |
| Backend | Rust, with [rusqlite](https://github.com/rusqlite/rusqlite) (bundled SQLite) and `rusqlite_migration` for the schema |
| Export | [rust_xlsxwriter](https://github.com/jmcnamara/rust_xlsxwriter) |
| Interface | React 19, TypeScript, [Vite](https://vite.dev) |
| Calendar | [FullCalendar](https://fullcalendar.io) v7 for the week and month grid |
| Time | `temporal-polyfill` and `rrule-temporal` for time zones and repeating Meetings, `ical.js` for `.ics` files |
| Design | Plain CSS custom properties in three layers (primitive, semantic, component). Pixelify Sans for the pixel font. |
| Tests | Vitest for the TypeScript code, `cargo test` for the Rust code |

The Rust side stores data and keeps it safe. The TypeScript side expands repeating Meetings and draws everything. Times are stored as UTC seconds with an IANA time zone, so a daylight-saving change never moves your hours.

---

## 🛠️ Development

**Set up**

```bash
npm install
npm run tauri dev      # the full app with the Rust backend and hot reload
```

**Useful commands**

| Command | What it does |
|---|---|
| `npm run tauri dev` | Run the app. The window reloads when you change the code. |
| `npm run dev` | Run only the web interface at `http://localhost:1420` (the backend calls fail). |
| `npm run typecheck` | Check the TypeScript types. |
| `npm test` | Run the Vitest tests and the Rust tests. |
| `npm run build` | Build the web interface only. |
| `npm run tauri build` | Build the installers. |

**Work in the browser, without the Rust backend**

A fake backend in `dev-mock/` lets you open the whole interface in a normal browser, with sample data and a fixed clock (Thursday 29 October 2026, 10:40).

```bash
MOCK=1 npx vite --port 1421
```

Then open `http://localhost:1421`. These options go in the address:

| Option | Effect |
|---|---|
| `?theme=dark` | Start in dark mode (`light` and `system` also work). |
| `?empty` | Start with no settings, to see the first-start screens. |
| `?fail={"kind":"tooNew","found":99,"supported":4}` | Show a startup problem. Other kinds: `corrupt`, `migration`. |
| `?now=09:35` | Move the clock. |
| `#popup` | Show the check-in popup. Then run `__emit('debug-popup')` in the console. |

**Project layout**

```
src/                 React interface (Calendar, Popup, Settings, Onboarding, ...)
src/schedule/        Pure date and schedule code: weeks, Meetings, Absences, .ics
src-tauri/src/       Rust: store (SQLite), safety (backups, recovery), export
docs/design-system/  Tokens, components and the design boards (the visual source of truth)
docs/adr/            Architecture decision records
dev-mock/            The fake backend for browser work
GLOSSARY.md          The words we use: Entry, Category, Meeting, Absence, Gap ...
```

**Good to know**

- The design boards in `docs/design-system/Work Tracker Design System.html` decide how the app looks. If the app and a board differ, the app changes. A few screens differ on purpose, and [ADR 0022](docs/adr/0022-calendar-toolbar-differs-from-the-board.md) lists them.
- Before you change how something works, read the [decision records](docs/adr/) and the [glossary](GLOSSARY.md).
- Checks that need a real desktop (tray, autostart, the popup, the window frame) are in [docs/manual-checks.md](docs/manual-checks.md).
- The bundle identifier is `app.worktracker`. It names the data folder. Do not change it unless you also move the data.

---

## 🗺️ Status

Hoot is a small side project in early development (version 0.1). It is developed on macOS. Windows is a build target, but nobody has tested it there yet. Planned and finished work is written down as tickets in `.scratch/`.

## 📄 License

No license has been chosen yet. Until there is one, all rights stay with the author.

<div align="center">
<br />
<sub>Made with a pixel owl in mind. Hoot hoot. 🦉</sub>
</div>
