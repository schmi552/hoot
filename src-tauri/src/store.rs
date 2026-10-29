//! Store: the SQLite file, its migrations and the commands that read and write it.

use rusqlite::{Connection, OptionalExtension, Result};
use rusqlite_migration::{Migrations, M};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Debug, PartialEq)]
pub struct Category {
    pub id: i64,
    pub name: String,
}

/// The schema version that the newest migration creates.
pub const LATEST_VERSION: i64 = 2;

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

/// Delete a Category, or archive it when Entries use it. Returns true if it was archived.
pub fn remove_category(conn: &Connection, id: i64) -> Result<bool> {
    let used: bool =
        conn.query_row("SELECT EXISTS(SELECT 1 FROM entry WHERE category_id = ?1)", [id], |r| r.get(0))?;
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

/// Save a new Entry. Fails if it is empty or overlaps another Entry. `entry.id` is ignored.
pub fn create_entry(conn: &Connection, entry: &Entry) -> std::result::Result<Entry, String> {
    if entry.end_utc <= entry.start_utc {
        return Err("An Entry must end after it starts.".into());
    }
    let overlaps: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM entry WHERE start_utc < ?2 AND end_utc > ?1)",
            [entry.start_utc, entry.end_utc],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if overlaps {
        return Err("This time already has an Entry.".into());
    }
    conn.execute(
        "INSERT INTO entry (category_id, description, start_utc, end_utc, tz) VALUES (?1, ?2, ?3, ?4, ?5)",
        (entry.category_id, &entry.description, entry.start_utc, entry.end_utc, &entry.tz),
    )
    .map_err(|e| e.to_string())?;
    Ok(Entry { id: conn.last_insert_rowid(), ..entry.clone() })
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

pub fn add_category(conn: &Connection, name: &str) -> Result<Category> {
    conn.execute("INSERT INTO category (name) VALUES (?1)", [name])?;
    Ok(Category { id: conn.last_insert_rowid(), name: name.to_string() })
}

pub fn list_categories(conn: &Connection) -> Result<Vec<Category>> {
    conn.prepare("SELECT id, name FROM category WHERE archived_at IS NULL ORDER BY name")?
        .query_map([], |r| Ok(Category { id: r.get(0)?, name: r.get(1)? }))?
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_category_written_through_the_store_is_read_back() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::safety::open_safely(dir.path()).unwrap();

        let added = add_category(&conn, "Project A").unwrap();

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
        let used = add_category(&conn, "Used").unwrap();
        let unused = add_category(&conn, "Unused").unwrap();
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
        let c = add_category(&conn, "A").unwrap();

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
    }
}
