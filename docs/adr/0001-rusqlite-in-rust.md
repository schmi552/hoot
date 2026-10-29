# Use rusqlite in Rust for the database

Rust owns the SQLite file through `rusqlite` and `rusqlite_migration`. The React side calls Tauri commands and never runs SQL. The Excel export and the sleep and wake gap check already run in Rust, so the schema and the migrations stay in one place. We did not choose the Tauri SQL plugin, where TypeScript runs the SQL. It would split data access between two languages.
