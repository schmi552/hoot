//! Data safety: startup checks, the pre-migration copy, the daily backup and recovery.

use crate::store;
use rusqlite::Connection;
use rusqlite_migration::Migrations;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const KEEP_DAILY: usize = 7;

/// Why the app could not open its database. The UI shows one screen for each kind.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Failure {
    #[serde(rename_all = "camelCase")]
    Migration { from: i64, to: i64, error: String },
    #[serde(rename_all = "camelCase")]
    TooNew { found: i64, supported: i64 },
    /// `latest_backup` is the date of the newest daily backup, if there is one.
    #[serde(rename_all = "camelCase")]
    Corrupt { error: String, latest_backup: Option<String> },
}

impl std::fmt::Display for Failure {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            Failure::Migration { from, to, error } => {
                write!(f, "The update from data version {from} to {to} failed: {error}")
            }
            Failure::TooNew { found, supported } => {
                write!(f, "The data has version {found}. This app supports up to version {supported}.")
            }
            Failure::Corrupt { error, .. } => write!(f, "The database is damaged: {error}"),
        }
    }
}

pub fn db_path(dir: &Path) -> PathBuf {
    dir.join("tracker.db")
}

pub fn backups_dir(dir: &Path) -> PathBuf {
    dir.join("backups")
}

/// Ask SQLite for a value, so the app needs no date crate.
fn sql<T: rusqlite::types::FromSql>(query: &str, params: impl rusqlite::Params) -> T {
    Connection::open_in_memory().unwrap().query_row(query, params, |r| r.get(0)).unwrap()
}

pub fn today() -> String {
    sql("SELECT date('now', 'localtime')", [])
}

/// Copy the open database to `dest` with `VACUUM INTO`. An old file at `dest` is replaced.
fn copy_db(conn: &Connection, dest: &Path) -> Result<(), String> {
    let _ = fs::remove_file(dest);
    conn.execute("VACUUM INTO ?1", [dest.to_str().unwrap()]).map(drop).map_err(|e| e.to_string())
}

/// Daily backups, oldest first. The pre-migration copy has another name, so it is not in this list.
fn daily_backups(dir: &Path) -> Vec<PathBuf> {
    let mut found: Vec<PathBuf> = fs::read_dir(backups_dir(dir))
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            let name = p.file_name().unwrap().to_string_lossy();
            name.len() == "tracker-0000-00-00.db".len()
                && name.starts_with("tracker-")
                && name.ends_with(".db")
        })
        .collect();
    found.sort();
    found
}

fn backup_date(path: &Path) -> String {
    path.file_stem().unwrap().to_string_lossy()["tracker-".len()..].to_string()
}

fn daily_backup(conn: &Connection, dir: &Path) -> Result<(), String> {
    fs::create_dir_all(backups_dir(dir)).map_err(|e| e.to_string())?;
    let todays = backups_dir(dir).join(format!("tracker-{}.db", today()));
    if !todays.exists() {
        copy_db(conn, &todays)?;
    }
    let all = daily_backups(dir);
    for old in &all[..all.len().saturating_sub(KEEP_DAILY)] {
        fs::remove_file(old).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Open the database in `dir` only if it is safe to do so.
pub fn open_safely(dir: &Path) -> Result<Connection, Failure> {
    open_with(dir, &store::migrations(), store::LATEST_VERSION)
}

fn open_with(dir: &Path, migrations: &Migrations, latest: i64) -> Result<Connection, Failure> {
    let corrupt = |error: String| Failure::Corrupt {
        error,
        latest_backup: daily_backups(dir).last().map(|p| backup_date(p)),
    };
    let mut conn = Connection::open(db_path(dir)).map_err(|e| corrupt(e.to_string()))?;
    let check: String = conn
        .pragma_query_value(None, "quick_check", |r| r.get(0))
        .map_err(|e| corrupt(e.to_string()))?;
    if check != "ok" {
        return Err(corrupt(check));
    }

    let found: i64 = conn
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .map_err(|e| corrupt(e.to_string()))?;
    if found > latest {
        return Err(Failure::TooNew { found, supported: latest });
    }
    if found < latest {
        let failed = |error: String| Failure::Migration { from: found, to: latest, error };
        if found > 0 {
            fs::create_dir_all(backups_dir(dir)).map_err(|e| failed(e.to_string()))?;
            copy_db(&conn, &backups_dir(dir).join("tracker-pre-migration.bak")).map_err(failed)?;
        }
        migrations.to_latest(&mut conn).map_err(|e| failed(e.to_string()))?;
    }

    if let Err(e) = daily_backup(&conn, dir) {
        eprintln!("daily backup failed: {e}");
    }
    Ok(conn)
}

/// Rename the bad database to `tracker-corrupt-<date>.db`. It never replaces an older corrupt file.
fn set_aside(dir: &Path) -> Result<PathBuf, String> {
    let date = today();
    let mut target = dir.join(format!("tracker-corrupt-{date}.db"));
    for n in 2.. {
        if !target.exists() {
            break;
        }
        target = dir.join(format!("tracker-corrupt-{date}-{n}.db"));
    }
    fs::rename(db_path(dir), &target).map_err(|e| e.to_string())?;
    Ok(target)
}

pub fn start_empty(dir: &Path) -> Result<Connection, String> {
    set_aside(dir)?;
    open_safely(dir).map_err(|f| f.to_string())
}

/// Returns the new connection and how many days of data may be missing.
pub fn restore_latest_backup(dir: &Path) -> Result<(Connection, i64), String> {
    let backup = daily_backups(dir).pop().ok_or("There is no backup.")?;
    let missing: i64 = sql("SELECT CAST(julianday(?1) - julianday(?2) AS INTEGER)", [today(), backup_date(&backup)]);
    let bad = set_aside(dir)?;
    let opened = fs::copy(&backup, db_path(dir))
        .map_err(|e| e.to_string())
        .and_then(|_| open_safely(dir).map_err(|f| f.to_string()));
    match opened {
        Ok(conn) => Ok((conn, missing)),
        Err(e) => {
            // Put the bad file back, so the next start shows the recovery screen again.
            let _ = fs::remove_file(db_path(dir));
            let _ = fs::rename(bad, db_path(dir));
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite_migration::M;

    fn count_categories(conn: &Connection) -> i64 {
        conn.query_row("SELECT count(*) FROM category", [], |r| r.get(0)).unwrap()
    }

    /// A database at version 1 with one category.
    fn dir_with_data() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        let conn = open_with(dir.path(), &first_migration(), 1).unwrap();
        store::add_category(&conn, "Project A").unwrap();
        dir
    }

    fn first_migration() -> Migrations<'static> {
        Migrations::new(vec![M::up(
            "CREATE TABLE category (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, archived_at INTEGER);",
        )])
    }

    fn two_migrations(second: &'static str) -> Migrations<'static> {
        Migrations::new(vec![
            M::up("CREATE TABLE category (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, archived_at INTEGER);"),
            M::up(second),
        ])
    }

    fn write_garbage(dir: &Path) {
        fs::write(db_path(dir), "this is not a database, it is just long enough to look like a file".repeat(100)).unwrap();
    }

    #[test]
    fn a_migration_is_preceded_by_a_copy_of_the_old_database() {
        let dir = dir_with_data();

        let conn = open_with(dir.path(), &two_migrations("CREATE TABLE extra (x);"), 2).unwrap();

        let bak = Connection::open(backups_dir(dir.path()).join("tracker-pre-migration.bak")).unwrap();
        assert_eq!(count_categories(&bak), 1);
        let version: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0)).unwrap();
        assert_eq!(version, 2);
    }

    #[test]
    fn a_failed_migration_leaves_the_data_and_reports_the_versions() {
        let dir = dir_with_data();

        let failure = open_with(dir.path(), &two_migrations("CREATE TABLE a (x); NOT SQL;"), 2).unwrap_err();

        let Failure::Migration { from, to, error } = failure else { panic!("{failure:?}") };
        assert_eq!((from, to), (1, 2));
        assert!(!error.is_empty());
        let conn = Connection::open(db_path(dir.path())).unwrap();
        assert_eq!(count_categories(&conn), 1);
        let version: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0)).unwrap();
        assert_eq!(version, 1);
        let table: Option<String> = conn
            .query_row("SELECT name FROM sqlite_master WHERE name = 'a'", [], |r| r.get(0))
            .ok();
        assert_eq!(table, None);
    }

    #[test]
    fn a_database_with_a_newer_version_is_refused() {
        let dir = dir_with_data();
        Connection::open(db_path(dir.path())).unwrap().pragma_update(None, "user_version", 99).unwrap();

        let failure = open_safely(dir.path()).unwrap_err();

        assert_eq!(failure, Failure::TooNew { found: 99, supported: store::LATEST_VERSION });
    }

    #[test]
    fn a_corrupt_file_is_reported_and_left_in_place() {
        let dir = tempfile::tempdir().unwrap();
        write_garbage(dir.path());

        let failure = open_safely(dir.path()).unwrap_err();

        assert!(matches!(failure, Failure::Corrupt { latest_backup: None, .. }));
        assert!(db_path(dir.path()).exists());
    }

    #[test]
    fn restore_brings_back_the_newest_backup_and_keeps_the_bad_file() {
        let dir = dir_with_data();
        // The backup from the first start has no data yet. Make today's backup again.
        fs::remove_file(backups_dir(dir.path()).join(format!("tracker-{}.db", today()))).unwrap();
        drop(open_safely(dir.path()).unwrap());
        write_garbage(dir.path());
        assert!(matches!(open_safely(dir.path()), Err(Failure::Corrupt { latest_backup: Some(_), .. })));

        let (conn, missing) = restore_latest_backup(dir.path()).unwrap();

        assert_eq!(count_categories(&conn), 1);
        assert_eq!(missing, 0);
        assert!(dir.path().join(format!("tracker-corrupt-{}.db", today())).exists());
    }

    #[test]
    fn start_empty_keeps_the_bad_file_and_makes_a_new_database() {
        let dir = tempfile::tempdir().unwrap();
        write_garbage(dir.path());

        let conn = start_empty(dir.path()).unwrap();

        assert_eq!(count_categories(&conn), 0);
        assert!(dir.path().join(format!("tracker-corrupt-{}.db", today())).exists());
    }

    #[test]
    fn a_failed_restore_puts_the_bad_file_back() {
        let dir = dir_with_data();
        Connection::open(backups_dir(dir.path()).join(format!("tracker-{}.db", today())))
            .unwrap()
            .pragma_update(None, "user_version", 99)
            .unwrap();
        write_garbage(dir.path());

        assert!(restore_latest_backup(dir.path()).is_err());

        assert!(matches!(open_safely(dir.path()), Err(Failure::Corrupt { .. })));
    }

    #[test]
    fn restore_without_a_backup_fails_and_changes_nothing() {
        let dir = tempfile::tempdir().unwrap();
        write_garbage(dir.path());

        assert!(restore_latest_backup(dir.path()).is_err());
        assert!(db_path(dir.path()).exists());
    }

    #[test]
    fn the_daily_backup_is_made_once_and_only_the_last_seven_stay() {
        let dir = dir_with_data();
        let backups = backups_dir(dir.path());
        for day in 1..=9 {
            fs::write(backups.join(format!("tracker-2020-01-{day:02}.db")), "old").unwrap();
        }
        fs::write(backups.join("tracker-pre-migration.bak"), "keep").unwrap();

        drop(open_safely(dir.path()).unwrap());

        let names: Vec<String> = daily_backups(dir.path()).iter().map(|p| backup_date(p)).collect();
        assert_eq!(names.len(), KEEP_DAILY);
        assert_eq!(names.last().unwrap(), &today());
        assert!(backups.join("tracker-pre-migration.bak").exists());
    }
}
