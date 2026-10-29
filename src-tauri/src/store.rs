//! Store: the SQLite file, its migrations and the commands that read and write it.

use rusqlite::{Connection, Result};
use rusqlite_migration::{Migrations, M};
use serde::Serialize;
use std::path::Path;

#[derive(Serialize, Debug, PartialEq)]
pub struct Category {
    pub id: i64,
    pub name: String,
}

fn migrations() -> Migrations<'static> {
    Migrations::new(vec![M::up(
        "CREATE TABLE category (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            archived_at INTEGER
        );",
    )])
}

/// Open the database file and bring it to the newest schema version.
pub fn open(path: &Path) -> Result<Connection> {
    let mut conn = Connection::open(path)?;
    migrations().to_latest(&mut conn).map_err(|e| match e {
        rusqlite_migration::Error::RusqliteError { err, .. } => err,
        other => rusqlite::Error::ToSqlConversionFailure(Box::new(other)),
    })?;
    Ok(conn)
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
        let conn = open(&dir.path().join("tracker.db")).unwrap();

        let added = add_category(&conn, "Project A").unwrap();

        assert_eq!(list_categories(&conn).unwrap(), vec![added]);
    }

    #[test]
    fn the_first_migration_sets_the_schema_version() {
        let dir = tempfile::tempdir().unwrap();
        let conn = open(&dir.path().join("tracker.db")).unwrap();

        let version: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0)).unwrap();

        assert_eq!(version, 1);
    }
}
