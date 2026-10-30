//! Store: the SQLite file, its migrations and the commands that read and write it.

use rusqlite::{Connection, OptionalExtension, Result};
use rusqlite_migration::{Migrations, M};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Debug, PartialEq)]
pub struct Category {
    pub id: i64,
    pub code: String,
    pub name: String,
    /// One of eight, 1 to 8.
    pub color: i64,
}

/// The schema version that the newest migration creates.
pub const LATEST_VERSION: i64 = 6;

/// Times are "HH:MM" in the zone `tz`. `effective_from` is not part of it: a save always starts today.
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub work_start: String,
    pub work_end: String,
    pub lunch_start: String,
    pub lunch_end: String,
    pub tz: String,
    pub interval_minutes: i64,
}

pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(
            "CREATE TABLE category (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                archived_at INTEGER
            );",
        ),
        // `entry` is here because removing a Category must know if it has Entries.
        M::up(
            "CREATE TABLE entry (
                id INTEGER PRIMARY KEY,
                category_id INTEGER NOT NULL REFERENCES category(id),
                description TEXT NOT NULL,
                start_utc INTEGER NOT NULL,
                end_utc INTEGER NOT NULL,
                tz TEXT NOT NULL
            );
            CREATE TABLE settings_history (
                effective_from TEXT PRIMARY KEY,
                work_start TEXT NOT NULL,
                work_end TEXT NOT NULL,
                lunch_start TEXT NOT NULL,
                lunch_end TEXT NOT NULL,
                tz TEXT NOT NULL,
                interval_minutes INTEGER NOT NULL
            );
            CREATE TABLE app_setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
        ),
        // No row for a date means the first popup of that day has not asked yet.
        M::up(
            "CREATE TABLE workday_location (
                date TEXT PRIMARY KEY,
                location TEXT NOT NULL CHECK (location IN ('home', 'office'))
            );",
        ),
        // A series holds one rule; TypeScript expands it. `start_local` is "YYYY-MM-DDTHH:MM" in `tz`.
        M::up(
            "CREATE TABLE meeting_series (
                id INTEGER PRIMARY KEY,
                category_id INTEGER NOT NULL REFERENCES category(id),
                title TEXT NOT NULL,
                start_local TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
                tz TEXT NOT NULL,
                rrule TEXT,
                source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ics')),
                ics_uid TEXT
            );
            CREATE TABLE meeting_exception (
                series_id INTEGER NOT NULL REFERENCES meeting_series(id) ON DELETE CASCADE,
                original_start_local TEXT NOT NULL,
                kind TEXT NOT NULL CHECK (kind IN ('skip', 'override')),
                start_local TEXT,
                duration_minutes INTEGER,
                title TEXT,
                category_id INTEGER REFERENCES category(id),
                PRIMARY KEY (series_id, original_start_local)
            );",
        ),
        // A full-day Absence holds local dates (inclusive); a part-day Absence holds UTC instants and the zone they were entered in.
        M::up(
            "CREATE TABLE absence (
                id INTEGER PRIMARY KEY,
                label TEXT NOT NULL,
                start_date TEXT,
                end_date TEXT,
                start_utc INTEGER,
                end_utc INTEGER,
                tz TEXT,
                CHECK (
                    (start_date IS NOT NULL AND end_date >= start_date AND start_utc IS NULL AND end_utc IS NULL AND tz IS NULL)
                    OR (start_date IS NULL AND end_date IS NULL AND end_utc > start_utc AND tz IS NOT NULL)
                )
            );",
        ),
        // Old names like "4711 Project A" split into code and name. Old Categories get colors 1 to 8 in `id` order, wrapping.
        // A code that another Category already has, or a name that would collide, stays unsplit (the lowest `id` wins).
        M::up(
            "ALTER TABLE category ADD COLUMN code TEXT NOT NULL DEFAULT '';
            ALTER TABLE category ADD COLUMN color INTEGER NOT NULL DEFAULT 1 CHECK (color BETWEEN 1 AND 8);
            UPDATE category SET color = (SELECT COUNT(*) FROM category c2 WHERE c2.id < category.id) % 8 + 1;
            UPDATE category SET code = substr(name, 1, instr(name, ' ') - 1)
                WHERE instr(name, ' ') > 0 AND substr(name, 1, instr(name, ' ') - 1) GLOB '*[0-9]*'
                AND trim(substr(name, instr(name, ' ') + 1)) <> ''
                AND id = (SELECT MIN(c2.id) FROM category c2
                          WHERE substr(c2.name, 1, instr(c2.name, ' ') - 1) = substr(category.name, 1, instr(category.name, ' ') - 1))
                AND id = (SELECT MIN(c2.id) FROM category c2
                          WHERE trim(substr(c2.name, instr(c2.name, ' ') + 1)) = trim(substr(category.name, instr(category.name, ' ') + 1)))
                AND NOT EXISTS (SELECT 1 FROM category c2 WHERE c2.name = trim(substr(category.name, instr(category.name, ' ') + 1)));
            UPDATE category SET name = trim(substr(name, length(code) + 2)) WHERE code <> '';
            CREATE UNIQUE INDEX category_code ON category(code) WHERE code <> '';",
        ),
    ])
}

/// Save `settings` from the date `today` on. A second save on the same day replaces the first.
pub fn save_settings(conn: &Connection, settings: &Settings, today: &str) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO settings_history
         (effective_from, work_start, work_end, lunch_start, lunch_end, tz, interval_minutes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        (
            today,
            &settings.work_start,
            &settings.work_end,
            &settings.lunch_start,
            &settings.lunch_end,
            &settings.tz,
            settings.interval_minutes,
        ),
    )
    .map(drop)
}

/// The settings that were true on `date` ("YYYY-MM-DD"). None before the first save.
pub fn settings_on(conn: &Connection, date: &str) -> Result<Option<Settings>> {
    conn.query_row(
        "SELECT work_start, work_end, lunch_start, lunch_end, tz, interval_minutes
         FROM settings_history WHERE effective_from <= ?1 ORDER BY effective_from DESC LIMIT 1",
        [date],
        |r| {
            Ok(Settings {
                work_start: r.get(0)?,
                work_end: r.get(1)?,
                lunch_start: r.get(2)?,
                lunch_end: r.get(3)?,
                tz: r.get(4)?,
                interval_minutes: r.get(5)?,
            })
        },
    )
    .optional()
}

/// Delete a Category, or archive it when an Entry, a Meeting series or an exception uses it. Returns true if it was archived.
pub fn remove_category(conn: &Connection, id: i64) -> Result<bool> {
    let used: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM entry WHERE category_id = ?1)
             OR EXISTS(SELECT 1 FROM meeting_series WHERE category_id = ?1)
             OR EXISTS(SELECT 1 FROM meeting_exception WHERE category_id = ?1)",
        [id],
        |r| r.get(0),
    )?;
    if used {
        conn.execute("UPDATE category SET archived_at = unixepoch() WHERE id = ?1", [id])?;
    } else {
        conn.execute("DELETE FROM category WHERE id = ?1", [id])?;
    }
    Ok(used)
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: i64,
    pub category_id: i64,
    pub description: String,
    pub start_utc: i64,
    pub end_utc: i64,
    pub tz: String,
}

/// Check an Entry before it is written: it must not be empty and must not overlap another Entry.
fn check_free(tx: &Connection, entry: &Entry) -> std::result::Result<(), String> {
    if entry.end_utc <= entry.start_utc {
        return Err("An Entry must end after it starts.".into());
    }
    let overlaps: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM entry WHERE id != ?3 AND start_utc < ?2 AND end_utc > ?1)",
            [entry.start_utc, entry.end_utc, entry.id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if overlaps {
        return Err("This time already has an Entry.".into());
    }
    Ok(())
}

/// Run `f` in one transaction, so no other writer can add an overlapping Entry between the check and the write.
fn in_tx<T>(conn: &Connection, f: impl FnOnce(&Connection) -> std::result::Result<T, String>) -> std::result::Result<T, String> {
    let tx = rusqlite::Transaction::new_unchecked(conn, rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;
    let out = f(&tx)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(out)
}

/// Save a new Entry. Fails if it is empty or overlaps another Entry. An `entry.id` of 0 gets a new id;
/// another id is kept, so that undo can bring back a deleted Entry.
pub fn create_entry(conn: &Connection, entry: &Entry) -> std::result::Result<Entry, String> {
    in_tx(conn, |tx| {
        check_free(tx, entry)?;
        tx.execute(
            "INSERT INTO entry (id, category_id, description, start_utc, end_utc, tz) VALUES (NULLIF(?1, 0), ?2, ?3, ?4, ?5, ?6)",
            (entry.id, entry.category_id, &entry.description, entry.start_utc, entry.end_utc, &entry.tz),
        )
        .map_err(|e| e.to_string())?;
        Ok(Entry { id: if entry.id == 0 { tx.last_insert_rowid() } else { entry.id }, ..entry.clone() })
    })
}

/// Replace an Entry. Fails if it is empty or overlaps another Entry.
pub fn update_entry(conn: &Connection, entry: &Entry) -> std::result::Result<(), String> {
    in_tx(conn, |tx| {
        check_free(tx, entry)?;
        let n = tx
            .execute(
                "UPDATE entry SET category_id = ?2, description = ?3, start_utc = ?4, end_utc = ?5, tz = ?6 WHERE id = ?1",
                (entry.id, entry.category_id, &entry.description, entry.start_utc, entry.end_utc, &entry.tz),
            )
            .map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("This Entry no longer exists.".into());
        }
        Ok(())
    })
}

/// Delete an Entry. A missing id is not an error.
pub fn delete_entry(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM entry WHERE id = ?1", [id]).map(|_| ())
}

/// The Entries that touch [from_utc, to_utc), oldest first.
pub fn list_entries(conn: &Connection, from_utc: i64, to_utc: i64) -> Result<Vec<Entry>> {
    conn.prepare(
        "SELECT id, category_id, description, start_utc, end_utc, tz FROM entry
         WHERE start_utc < ?2 AND end_utc > ?1 ORDER BY start_utc",
    )?
    .query_map([from_utc, to_utc], |r| {
        Ok(Entry {
            id: r.get(0)?,
            category_id: r.get(1)?,
            description: r.get(2)?,
            start_utc: r.get(3)?,
            end_utc: r.get(4)?,
            tz: r.get(5)?,
        })
    })?
    .collect()
}

/// The lowest color that no active Category has. When all eight are taken, the color with the fewest Entries and Meetings (a tie goes to the lowest).
fn next_color(conn: &Connection) -> Result<i64> {
    conn.query_row(
        "WITH n(color) AS (VALUES (1),(2),(3),(4),(5),(6),(7),(8))
         SELECT n.color FROM n
         LEFT JOIN category c ON c.color = n.color AND c.archived_at IS NULL
         GROUP BY n.color
         ORDER BY COUNT(c.id) > 0,
                  SUM((SELECT COUNT(*) FROM entry WHERE category_id = c.id)
                    + (SELECT COUNT(*) FROM meeting_series WHERE category_id = c.id)
                    + (SELECT COUNT(*) FROM meeting_exception WHERE category_id = c.id)),
                  n.color
         LIMIT 1",
        [],
        |r| r.get(0),
    )
}

/// An empty `code` is allowed any number of times; a code is unique otherwise.
pub fn add_category(conn: &Connection, code: &str, name: &str) -> Result<Category> {
    let color = next_color(conn)?;
    conn.execute("INSERT INTO category (code, name, color) VALUES (?1, ?2, ?3)", (code, name, color))?;
    Ok(Category { id: conn.last_insert_rowid(), code: code.to_string(), name: name.to_string(), color })
}

pub fn update_category(conn: &Connection, id: i64, code: &str, color: i64) -> Result<()> {
    conn.execute("UPDATE category SET code = ?2, color = ?3 WHERE id = ?1", (id, code, color)).map(drop)
}

pub fn list_categories(conn: &Connection) -> Result<Vec<Category>> {
    conn.prepare("SELECT id, code, name, color FROM category WHERE archived_at IS NULL ORDER BY code = '', code, name")?
        .query_map([], |r| Ok(Category { id: r.get(0)?, code: r.get(1)?, name: r.get(2)?, color: r.get(3)? }))?
        .collect()
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MeetingSeries {
    pub id: i64,
    pub category_id: i64,
    pub title: String,
    pub start_local: String,
    pub duration_minutes: i64,
    pub tz: String,
    pub rrule: Option<String>,
}

/// Save a new Meeting series. The `id` of `m` is ignored.
pub fn create_meeting(conn: &Connection, m: &MeetingSeries) -> Result<MeetingSeries> {
    conn.execute(
        "INSERT INTO meeting_series (category_id, title, start_local, duration_minutes, tz, rrule) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (m.category_id, &m.title, &m.start_local, m.duration_minutes, &m.tz, &m.rrule),
    )?;
    Ok(MeetingSeries { id: conn.last_insert_rowid(), ..m.clone() })
}

/// All Meeting series. There are few, so TypeScript expands them for the visible range.
pub fn list_meetings(conn: &Connection) -> Result<Vec<MeetingSeries>> {
    conn.prepare("SELECT id, category_id, title, start_local, duration_minutes, tz, rrule FROM meeting_series ORDER BY id")?
        .query_map([], |r| {
            Ok(MeetingSeries {
                id: r.get(0)?,
                category_id: r.get(1)?,
                title: r.get(2)?,
                start_local: r.get(3)?,
                duration_minutes: r.get(4)?,
                tz: r.get(5)?,
                rrule: r.get(6)?,
            })
        })?
        .collect()
}

/// Change every occurrence: replace the fields of the series `m.id` that the dialog edits.
/// A new start time drops the exceptions, because they are keyed by the old start times.
pub fn update_meeting(conn: &Connection, m: &MeetingSeries) -> Result<()> {
    conn.execute(
        "DELETE FROM meeting_exception WHERE series_id = ?1 AND (SELECT start_local FROM meeting_series WHERE id = ?1) != ?2",
        (m.id, &m.start_local),
    )?;
    conn.execute(
        "UPDATE meeting_series SET category_id = ?2, title = ?3, start_local = ?4, duration_minutes = ?5 WHERE id = ?1",
        (m.id, m.category_id, &m.title, &m.start_local, m.duration_minutes),
    )?;
    Ok(())
}

/// Delete a series with its exceptions.
pub fn delete_meeting(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM meeting_exception WHERE series_id = ?1", [id])?;
    conn.execute("DELETE FROM meeting_series WHERE id = ?1", [id])?;
    Ok(())
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MeetingException {
    pub series_id: i64,
    pub original_start_local: String,
    pub kind: String,
    pub start_local: Option<String>,
    pub duration_minutes: Option<i64>,
    pub title: Option<String>,
    pub category_id: Option<i64>,
}

/// Skip or override one occurrence. A second change of the same occurrence replaces the first.
pub fn set_meeting_exception(conn: &Connection, x: &MeetingException) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO meeting_exception (series_id, original_start_local, kind, start_local, duration_minutes, title, category_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        (x.series_id, &x.original_start_local, &x.kind, &x.start_local, x.duration_minutes, &x.title, x.category_id),
    )?;
    Ok(())
}

/// One Meeting series from an `.ics` file with its exceptions. The ids inside are ignored.
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub struct ImportedMeeting {
    pub series: MeetingSeries,
    pub exceptions: Vec<MeetingException>,
}

/// Save imported Meetings. All of them are saved or none.
pub fn import_meetings(conn: &mut Connection, meetings: &[ImportedMeeting]) -> Result<()> {
    let tx = conn.transaction()?;
    for m in meetings {
        let id = create_meeting(&tx, &m.series)?.id;
        for x in &m.exceptions {
            set_meeting_exception(&tx, &MeetingException { series_id: id, ..x.clone() })?;
        }
    }
    tx.commit()
}

pub fn list_meeting_exceptions(conn: &Connection) -> Result<Vec<MeetingException>> {
    conn.prepare("SELECT series_id, original_start_local, kind, start_local, duration_minutes, title, category_id FROM meeting_exception")?
        .query_map([], |r| {
            Ok(MeetingException {
                series_id: r.get(0)?,
                original_start_local: r.get(1)?,
                kind: r.get(2)?,
                start_local: r.get(3)?,
                duration_minutes: r.get(4)?,
                title: r.get(5)?,
                category_id: r.get(6)?,
            })
        })?
        .collect()
}

/// Time away. A full-day Absence has `start_date` and `end_date` ("YYYY-MM-DD", both included); a part-day Absence has `start_utc`, `end_utc` and `tz`.
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Absence {
    pub id: i64,
    pub label: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub start_utc: Option<i64>,
    pub end_utc: Option<i64>,
    pub tz: Option<String>,
}

/// Save a new Absence. The `id` of `a` is ignored. The table refuses a row that is neither a full-day nor a part-day Absence.
pub fn create_absence(conn: &Connection, a: &Absence) -> Result<Absence> {
    conn.execute(
        "INSERT INTO absence (label, start_date, end_date, start_utc, end_utc, tz) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (&a.label, &a.start_date, &a.end_date, a.start_utc, a.end_utc, &a.tz),
    )?;
    Ok(Absence { id: conn.last_insert_rowid(), ..a.clone() })
}

/// All Absences. There are few, so TypeScript picks the ones in the visible range.
pub fn list_absences(conn: &Connection) -> Result<Vec<Absence>> {
    conn.prepare("SELECT id, label, start_date, end_date, start_utc, end_utc, tz FROM absence ORDER BY id")?
        .query_map([], |r| {
            Ok(Absence { id: r.get(0)?, label: r.get(1)?, start_date: r.get(2)?, end_date: r.get(3)?, start_utc: r.get(4)?, end_utc: r.get(5)?, tz: r.get(6)? })
        })?
        .collect()
}

pub fn delete_absence(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM absence WHERE id = ?1", [id]).map(drop)
}

#[derive(Serialize, Debug, PartialEq)]
pub struct WorkdayLocation {
    pub date: String,
    pub location: String,
}

/// Set the Workday location of `date` ("YYYY-MM-DD"). A second answer replaces the first.
pub fn set_workday_location(conn: &Connection, date: &str, location: &str) -> Result<()> {
    conn.execute("INSERT OR REPLACE INTO workday_location (date, location) VALUES (?1, ?2)", [date, location]).map(drop)
}

/// The answered Workday locations from `from` to `to`, both dates included.
pub fn list_workday_locations(conn: &Connection, from: &str, to: &str) -> Result<Vec<WorkdayLocation>> {
    conn.prepare("SELECT date, location FROM workday_location WHERE date BETWEEN ?1 AND ?2 ORDER BY date")?
        .query_map([from, to], |r| Ok(WorkdayLocation { date: r.get(0)?, location: r.get(1)? }))?
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_category_written_through_the_store_is_read_back() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::safety::open_safely(dir.path()).unwrap();

        let added = add_category(&conn, "", "Project A").unwrap();

        assert_eq!(list_categories(&conn).unwrap(), vec![added]);
    }

    #[test]
    fn the_first_migration_sets_the_schema_version() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::safety::open_safely(dir.path()).unwrap();

        let version: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0)).unwrap();

        assert_eq!(version, LATEST_VERSION);
    }

    fn settings(work_start: &str) -> Settings {
        Settings {
            work_start: work_start.into(),
            work_end: "17:00".into(),
            lunch_start: "12:00".into(),
            lunch_end: "13:00".into(),
            tz: "Europe/Berlin".into(),
            interval_minutes: 60,
        }
    }

    #[test]
    fn a_past_day_keeps_the_settings_that_were_true_on_that_day() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::safety::open_safely(dir.path()).unwrap();
        save_settings(&conn, &settings("08:00"), "2026-01-01").unwrap();
        save_settings(&conn, &settings("09:30"), "2026-03-01").unwrap();

        assert_eq!(settings_on(&conn, "2025-12-31").unwrap(), None);
        assert_eq!(settings_on(&conn, "2026-02-28").unwrap(), Some(settings("08:00")));
        assert_eq!(settings_on(&conn, "2026-03-01").unwrap(), Some(settings("09:30")));
        assert_eq!(settings_on(&conn, "2026-06-01").unwrap(), Some(settings("09:30")));
    }

    #[test]
    fn a_second_save_on_the_same_day_replaces_the_first() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::safety::open_safely(dir.path()).unwrap();
        save_settings(&conn, &settings("08:00"), "2026-01-01").unwrap();
        save_settings(&conn, &settings("07:00"), "2026-01-01").unwrap();

        assert_eq!(settings_on(&conn, "2026-01-01").unwrap(), Some(settings("07:00")));
    }

    #[test]
    fn a_category_with_entries_is_archived_and_one_without_is_deleted() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::safety::open_safely(dir.path()).unwrap();
        let used = add_category(&conn, "", "Used").unwrap();
        let unused = add_category(&conn, "", "Unused").unwrap();
        conn.execute(
            "INSERT INTO entry (category_id, description, start_utc, end_utc, tz) VALUES (?1, 'x', 0, 900, 'UTC')",
            [used.id],
        )
        .unwrap();

        assert!(remove_category(&conn, used.id).unwrap());
        assert!(!remove_category(&conn, unused.id).unwrap());

        assert_eq!(list_categories(&conn).unwrap(), vec![]);
        let kept: i64 = conn.query_row("SELECT COUNT(*) FROM category", [], |r| r.get(0)).unwrap();
        assert_eq!(kept, 1);
    }

    fn entry(category_id: i64, start_utc: i64, end_utc: i64) -> Entry {
        Entry { id: 0, category_id, description: "work".into(), start_utc, end_utc, tz: "UTC".into() }
    }

    #[test]
    fn an_entry_is_saved_and_listed_and_one_that_overlaps_is_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::safety::open_safely(dir.path()).unwrap();
        let c = add_category(&conn, "", "A").unwrap();

        let first = create_entry(&conn, &entry(c.id, 1000, 2000)).unwrap();
        // Entries that touch at the edge do not overlap.
        let next = create_entry(&conn, &entry(c.id, 2000, 3000)).unwrap();
        for (s, e) in [(1500, 2500), (500, 1001), (1200, 1300), (900, 3100)] {
            assert!(create_entry(&conn, &entry(c.id, s, e)).is_err(), "{s}-{e}");
        }
        assert!(create_entry(&conn, &entry(c.id, 3000, 3000)).is_err());

        assert_eq!(list_entries(&conn, 0, 10_000).unwrap(), vec![first.clone(), next]);
        assert_eq!(list_entries(&conn, 0, 1000).unwrap(), vec![]);
        assert_eq!(list_entries(&conn, 1999, 2001).unwrap().len(), 2);

        // An Entry can change in place but not into another Entry.
        let moved = Entry { start_utc: 1100, end_utc: 1900, ..first.clone() };
        update_entry(&conn, &moved).unwrap();
        assert!(update_entry(&conn, &Entry { end_utc: 2001, ..moved.clone() }).is_err());

        // Delete, then undo: the Entry comes back with its id.
        delete_entry(&conn, moved.id).unwrap();
        assert_eq!(create_entry(&conn, &moved).unwrap().id, moved.id);
    }

    #[test]
    fn a_failed_write_returns_an_error_and_changes_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::safety::open_safely(dir.path()).unwrap();
        let c = add_category(&conn, "", "A").unwrap();
        let saved = create_entry(&conn, &entry(c.id, 1000, 2000)).unwrap();

        conn.execute_batch("PRAGMA query_only = ON").unwrap(); // every write now fails
        assert!(create_entry(&conn, &entry(c.id, 3000, 4000)).is_err());
        assert!(update_entry(&conn, &Entry { end_utc: 1500, ..saved.clone() }).is_err());
        assert!(delete_entry(&conn, saved.id).is_err());

        conn.execute_batch("PRAGMA query_only = OFF").unwrap();
        assert_eq!(list_entries(&conn, 0, 10_000).unwrap(), vec![saved]);
    }

    #[test]
    fn a_workday_location_is_read_back_and_a_new_answer_replaces_the_old_one() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::safety::open_safely(dir.path()).unwrap();
        let loc = |date: &str, location: &str| WorkdayLocation { date: date.into(), location: location.into() };

        set_workday_location(&conn, "2026-10-29", "home").unwrap();
        set_workday_location(&conn, "2026-10-30", "home").unwrap();
        set_workday_location(&conn, "2026-10-30", "office").unwrap();

        assert_eq!(list_workday_locations(&conn, "2026-10-30", "2026-10-30").unwrap(), vec![loc("2026-10-30", "office")]);
        assert_eq!(list_workday_locations(&conn, "2026-10-01", "2026-10-31").unwrap().len(), 2);
        assert_eq!(list_workday_locations(&conn, "2026-11-01", "2026-11-30").unwrap(), vec![]);
        assert!(set_workday_location(&conn, "2026-10-31", "moon").is_err());
    }

    #[test]
    fn an_import_saves_every_series_with_its_exceptions_or_none() {
        let dir = tempfile::tempdir().unwrap();
        let mut conn = crate::safety::open_safely(dir.path()).unwrap();
        let c = add_category(&conn, "", "A").unwrap();
        let series = |duration_minutes| MeetingSeries { id: 0, category_id: c.id, title: "Standup".into(), start_local: "2026-03-23T10:00".into(), duration_minutes, tz: "Europe/Berlin".into(), rrule: Some("FREQ=DAILY".into()) };
        let skip = MeetingException { series_id: 0, original_start_local: "2026-03-24T10:00".into(), kind: "skip".into(), start_local: None, duration_minutes: None, title: None, category_id: None };

        // The second series has a bad duration, so the first must not stay either.
        let bad = [ImportedMeeting { series: series(30), exceptions: vec![skip.clone()] }, ImportedMeeting { series: series(0), exceptions: vec![] }];
        assert!(import_meetings(&mut conn, &bad).is_err());
        assert!(list_meetings(&conn).unwrap().is_empty());

        import_meetings(&mut conn, &bad[..1]).unwrap();
        let saved = list_meetings(&conn).unwrap();
        assert_eq!(saved.len(), 1);
        assert_eq!(list_meeting_exceptions(&conn).unwrap(), vec![MeetingException { series_id: saved[0].id, ..skip }]);
    }

    #[test]
    fn a_meeting_series_is_read_back_and_a_bad_duration_is_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::safety::open_safely(dir.path()).unwrap();
        let c = add_category(&conn, "", "A").unwrap();
        let m = MeetingSeries {
            id: 0,
            category_id: c.id,
            title: "Standup".into(),
            start_local: "2026-03-23T10:00".into(),
            duration_minutes: 30,
            tz: "Europe/Berlin".into(),
            rrule: Some("FREQ=DAILY".into()),
        };

        let saved = create_meeting(&conn, &m).unwrap();

        assert_eq!(list_meetings(&conn).unwrap(), vec![saved]);
        assert!(create_meeting(&conn, &MeetingSeries { duration_minutes: 0, ..m }).is_err());
    }

    #[test]
    fn an_exception_is_replaced_by_a_later_one_and_goes_with_its_series() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::safety::open_safely(dir.path()).unwrap();
        let c = add_category(&conn, "", "A").unwrap();
        let m = create_meeting(
            &conn,
            &MeetingSeries { id: 0, category_id: c.id, title: "Standup".into(), start_local: "2026-03-23T10:00".into(), duration_minutes: 30, tz: "Europe/Berlin".into(), rrule: Some("FREQ=DAILY".into()) },
        )
        .unwrap();
        let x = MeetingException { series_id: m.id, original_start_local: "2026-03-24T10:00".into(), kind: "skip".into(), start_local: None, duration_minutes: None, title: None, category_id: None };

        set_meeting_exception(&conn, &x).unwrap();
        let moved = MeetingException { kind: "override".into(), start_local: Some("2026-03-24T14:00".into()), ..x.clone() };
        set_meeting_exception(&conn, &moved).unwrap();
        assert_eq!(list_meeting_exceptions(&conn).unwrap(), vec![moved]);
        assert!(set_meeting_exception(&conn, &MeetingException { kind: "other".into(), ..x }).is_err());

        update_meeting(&conn, &MeetingSeries { title: "Daily".into(), ..m.clone() }).unwrap();
        assert_eq!(list_meetings(&conn).unwrap()[0].title, "Daily");
        assert_eq!(list_meeting_exceptions(&conn).unwrap().len(), 1); // same start, so the exception stays
        update_meeting(&conn, &MeetingSeries { start_local: "2026-03-23T11:00".into(), ..m.clone() }).unwrap();
        assert!(list_meeting_exceptions(&conn).unwrap().is_empty());
        delete_meeting(&conn, m.id).unwrap();
        assert!(list_meetings(&conn).unwrap().is_empty());
        assert!(list_meeting_exceptions(&conn).unwrap().is_empty());
    }

    #[test]
    fn an_absence_of_either_kind_is_read_back_and_a_mixed_one_is_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::safety::open_safely(dir.path()).unwrap();
        let full = Absence { id: 0, label: "Vacation".into(), start_date: Some("2026-08-03".into()), end_date: Some("2026-08-07".into()), start_utc: None, end_utc: None, tz: None };
        let part = Absence { id: 0, label: "Doctor".into(), start_date: None, end_date: None, start_utc: Some(1000), end_utc: Some(4600), tz: Some("Europe/Berlin".into()) };

        let saved = vec![create_absence(&conn, &full).unwrap(), create_absence(&conn, &part).unwrap()];

        assert_eq!(list_absences(&conn).unwrap(), saved);
        assert!(create_absence(&conn, &Absence { end_date: Some("2026-08-02".into()), ..full.clone() }).is_err());
        assert!(create_absence(&conn, &Absence { start_date: Some("2026-08-03".into()), ..part.clone() }).is_err());
        assert!(create_absence(&conn, &Absence { end_utc: Some(1000), ..part }).is_err());
        delete_absence(&conn, saved[0].id).unwrap();
        assert_eq!(list_absences(&conn).unwrap(), vec![saved[1].clone()]);
    }

    fn open() -> (tempfile::TempDir, Connection) {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::safety::open_safely(dir.path()).unwrap();
        (dir, conn)
    }

    fn colors(conn: &Connection) -> Vec<i64> {
        list_categories(conn).unwrap().iter().map(|c| c.color).collect()
    }

    #[test]
    fn old_categories_split_the_code_and_get_colors_in_id_order() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrations().to_version(&mut conn, 5).unwrap();
        for i in 1..=10 {
            let name = if i == 1 { "4711 Project A".to_string() } else if i == 2 { "Internal work".to_string() } else { format!("C{i}") };
            conn.execute("INSERT INTO category (name) VALUES (?1)", [name]).unwrap();
        }

        migrations().to_latest(&mut conn).unwrap();

        let rows: Vec<(String, String, i64)> = conn
            .prepare("SELECT code, name, color FROM category ORDER BY id").unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))).unwrap()
            .collect::<Result<_>>().unwrap();
        assert_eq!(rows[0], ("4711".into(), "Project A".into(), 1));
        assert_eq!(rows[1], ("".into(), "Internal work".into(), 2), "no digit in the first token: no split");
        assert_eq!(rows[8].2, 1, "the ninth wraps to color 1");
        assert_eq!(rows[9].2, 2);
    }

    #[test]
    fn the_migration_keeps_a_name_when_the_code_is_taken() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrations().to_version(&mut conn, 5).unwrap();
        for n in ["1 A", "1 B"] {
            conn.execute("INSERT INTO category (name) VALUES (?1)", [n]).unwrap();
        }

        migrations().to_latest(&mut conn).unwrap();

        let names: Vec<String> = conn.prepare("SELECT code || '|' || name FROM category ORDER BY id").unwrap()
            .query_map([], |r| r.get(0)).unwrap().collect::<Result<_>>().unwrap();
        assert_eq!(names, ["1|A", "|1 B"]);
    }

    #[test]
    fn a_new_category_gets_the_next_free_color() {
        let (_d, conn) = open();
        for n in ["a", "b", "c"] {
            add_category(&conn, "", n).unwrap();
        }
        assert_eq!(colors(&conn), [1, 2, 3]);
    }

    #[test]
    fn the_ninth_category_gets_the_least_used_color_and_a_tie_the_lowest() {
        let (_d, conn) = open();
        let cats: Vec<Category> = (1..=8).map(|i| add_category(&conn, "", &format!("c{i}")).unwrap()).collect();
        // Color 1 has two Entries, color 2 one Entry, all others none.
        let use_it = |c: &Category, n: i64| {
            for _ in 0..n {
                conn.execute("INSERT INTO entry (category_id, description, start_utc, end_utc, tz) VALUES (?1, 'x', 0, 900, 'UTC')", [c.id]).unwrap();
            }
        };
        use_it(&cats[0], 2);
        use_it(&cats[1], 1);
        assert_eq!(add_category(&conn, "", "ninth").unwrap().color, 3, "a tie between 3 to 8 goes to the lowest");

        use_it(&cats[2], 5);
        conn.execute("INSERT INTO meeting_series (category_id, title, start_local, duration_minutes, tz) VALUES (?1, 'm', '2026-03-23T10:00', 30, 'UTC')", [cats[3].id]).unwrap();
        assert_eq!(add_category(&conn, "", "tenth").unwrap().color, 5, "colors 1 to 4 are used, so color 5 is the lowest of the unused ones");
    }

    #[test]
    fn an_archived_category_keeps_its_color_and_frees_it() {
        let (_d, conn) = open();
        let a = add_category(&conn, "", "a").unwrap();
        add_category(&conn, "", "b").unwrap();
        conn.execute("INSERT INTO entry (category_id, description, start_utc, end_utc, tz) VALUES (?1, 'x', 0, 900, 'UTC')", [a.id]).unwrap();
        assert!(remove_category(&conn, a.id).unwrap());

        assert_eq!(add_category(&conn, "", "c").unwrap().color, 1);
        let kept: i64 = conn.query_row("SELECT color FROM category WHERE id = ?1", [a.id], |r| r.get(0)).unwrap();
        assert_eq!(kept, 1);
    }

    #[test]
    fn a_duplicate_code_is_refused_and_empty_codes_are_not() {
        let (_d, conn) = open();
        add_category(&conn, "4711", "a").unwrap();

        assert!(add_category(&conn, "4711", "b").is_err());
        add_category(&conn, "", "c").unwrap();
        add_category(&conn, "", "d").unwrap();
    }

    #[test]
    fn the_user_can_change_code_and_color() {
        let (_d, conn) = open();
        let a = add_category(&conn, "", "a").unwrap();

        update_category(&conn, a.id, "99", 7).unwrap();

        let c = &list_categories(&conn).unwrap()[0];
        assert_eq!((c.code.as_str(), c.color), ("99", 7));
        assert!(update_category(&conn, a.id, "99", 9).is_err(), "only eight colors");
    }

    #[test]
    fn a_category_used_only_by_a_series_or_an_exception_is_archived() {
        let (_d, conn) = open();
        let by_series = add_category(&conn, "", "s").unwrap();
        let by_exception = add_category(&conn, "", "e").unwrap();
        let host = add_category(&conn, "", "h").unwrap();
        conn.execute("INSERT INTO meeting_series (category_id, title, start_local, duration_minutes, tz) VALUES (?1, 'm', '2026-03-23T10:00', 30, 'UTC')", [by_series.id]).unwrap();
        conn.execute("INSERT INTO meeting_series (category_id, title, start_local, duration_minutes, tz) VALUES (?1, 'm', '2026-03-23T10:00', 30, 'UTC')", [host.id]).unwrap();
        conn.execute("INSERT INTO meeting_exception (series_id, original_start_local, kind, category_id) VALUES (?1, '2026-03-24T10:00', 'override', ?2)", (conn.last_insert_rowid(), by_exception.id)).unwrap();

        assert!(remove_category(&conn, by_series.id).unwrap());
        assert!(remove_category(&conn, by_exception.id).unwrap());
    }

    #[test]
    fn the_migration_does_not_fail_when_two_split_names_would_be_equal() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrations().to_version(&mut conn, 5).unwrap();
        for n in ["1 A", "2 A"] {
            conn.execute("INSERT INTO category (name) VALUES (?1)", [n]).unwrap();
        }

        migrations().to_latest(&mut conn).unwrap();

        let names: Vec<String> = conn.prepare("SELECT code || '|' || name FROM category ORDER BY id").unwrap()
            .query_map([], |r| r.get(0)).unwrap().collect::<Result<_>>().unwrap();
        assert_eq!(names, ["1|A", "|2 A"]);
    }

    #[test]
    fn changing_a_code_to_a_taken_one_is_refused() {
        let (_d, conn) = open();
        add_category(&conn, "1", "a").unwrap();
        let b = add_category(&conn, "", "b").unwrap();

        assert!(update_category(&conn, b.id, "1", b.color).is_err());
    }
}
