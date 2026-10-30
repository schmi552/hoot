mod safety;
mod store;

use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

struct Db(Mutex<rusqlite::Connection>);

/// Why the database did not open. Empty once the app has a working database.
struct StartupFailure(Mutex<Option<safety::Failure>>);

#[tauri::command]
fn add_category(db: State<Db>, name: String) -> Result<store::Category, String> {
    store::add_category(&db.0.lock().unwrap(), &name).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_categories(db: State<Db>) -> Result<Vec<store::Category>, String> {
    store::list_categories(&db.0.lock().unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_category(db: State<Db>, id: i64) -> Result<bool, String> {
    store::remove_category(&db.0.lock().unwrap(), id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_settings(db: State<Db>) -> Result<Option<store::Settings>, String> {
    store::settings_on(&db.0.lock().unwrap(), &safety::today()).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_settings(db: State<Db>, settings: store::Settings) -> Result<(), String> {
    store::save_settings(&db.0.lock().unwrap(), &settings, &safety::today()).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_entry(db: State<Db>, entry: store::Entry) -> Result<store::Entry, String> {
    store::create_entry(&db.0.lock().unwrap(), &entry)
}

#[tauri::command]
fn update_entry(db: State<Db>, entry: store::Entry) -> Result<(), String> {
    store::update_entry(&db.0.lock().unwrap(), &entry)
}

#[tauri::command]
fn delete_entry(db: State<Db>, id: i64) -> Result<(), String> {
    store::delete_entry(&db.0.lock().unwrap(), id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_entries(db: State<Db>, from_utc: i64, to_utc: i64) -> Result<Vec<store::Entry>, String> {
    store::list_entries(&db.0.lock().unwrap(), from_utc, to_utc).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_workday_location(db: State<Db>, date: String, location: String) -> Result<(), String> {
    store::set_workday_location(&db.0.lock().unwrap(), &date, &location).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_workday_locations(db: State<Db>, from: String, to: String) -> Result<Vec<store::WorkdayLocation>, String> {
    store::list_workday_locations(&db.0.lock().unwrap(), &from, &to).map_err(|e| e.to_string())
}

fn recovered(app: &AppHandle, conn: rusqlite::Connection) {
    app.manage(Db(Mutex::new(conn)));
    *app.state::<StartupFailure>().0.lock().unwrap() = None;
}

#[tauri::command]
fn startup_failure(failure: State<StartupFailure>) -> Option<safety::Failure> {
    failure.0.lock().unwrap().clone()
}

/// Both recovery commands start the app on a new database. They fail if the file move or copy fails.
#[tauri::command]
fn start_empty(app: AppHandle) -> Result<(), String> {
    let conn = safety::start_empty(&app.path().app_data_dir().map_err(|e| e.to_string())?)?;
    recovered(&app, conn);
    Ok(())
}

/// Returns how many days of data may be missing.
#[tauri::command]
fn restore_latest_backup(app: AppHandle) -> Result<i64, String> {
    let (conn, missing) =
        safety::restore_latest_backup(&app.path().app_data_dir().map_err(|e| e.to_string())?)?;
    recovered(&app, conn);
    Ok(missing)
}

#[tauri::command]
fn show_backups_folder(app: AppHandle) -> Result<(), String> {
    let dir = safety::backups_dir(&app.path().app_data_dir().map_err(|e| e.to_string())?);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let opener = if cfg!(target_os = "macos") {
        "open"
    } else if cfg!(target_os = "windows") {
        "explorer"
    } else {
        "xdg-open"
    };
    std::process::Command::new(opener).arg(dir).spawn().map(drop).map_err(|e| e.to_string())
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

/// Show or hide the always-on-top popup window. The window is created hidden at startup.
#[tauri::command]
fn set_popup_visible(app: AppHandle, visible: bool) {
    if let Some(w) = app.get_webview_window("popup") {
        let _ = if visible { w.show().and_then(|_| w.set_focus()) } else { w.hide() };
    }
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Tick {
    now_utc: i64,
    /// Seconds since the last tick. Much more than 60 means sleep, wake or a closed app.
    elapsed_secs: i64,
}

/// Emit a `tick` event every minute by wall clock, once the database is open.
fn start_ticker(app: AppHandle) {
    std::thread::spawn(move || {
        let now = || SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs() as i64);
        let mut last = now();
        loop {
            std::thread::sleep(Duration::from_secs(60 - (now() % 60) as u64)); // wake on the minute
            let (now_utc, elapsed_secs) = (now(), now() - last);
            last = now_utc;
            if app.try_state::<Db>().is_some() {
                let _ = app.emit("tick", Tick { now_utc, elapsed_secs });
            }
        }
    });
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            // Without a database no other part of the app starts (the ticker waits for the database).
            match safety::open_safely(&dir) {
                Ok(conn) => {
                    app.manage(Db(Mutex::new(conn)));
                    app.manage(StartupFailure(Mutex::new(None)));
                }
                Err(failure) => {
                    app.manage(StartupFailure(Mutex::new(Some(failure))));
                }
            }

            let menu = Menu::with_items(
                app,
                &[
                    &MenuItem::with_id(app, "open", "Open", true, None::<&str>)?,
                    &MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?,
                ],
            )?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            start_ticker(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let (WindowEvent::CloseRequested { api, .. }, "main" | "popup") = (event, window.label()) {
                api.prevent_close();
                let _ = window.hide();
                let _ = window.emit("popup-closed", ()); // the popup page must stop waiting for an answer
            }
        })
        .invoke_handler(tauri::generate_handler![
            add_category,
            list_categories,
            remove_category,
            get_settings,
            save_settings,
            create_entry,
            update_entry,
            delete_entry,
            list_entries,
            set_workday_location,
            list_workday_locations,
            startup_failure,
            start_empty,
            restore_latest_backup,
            show_backups_folder,
            set_popup_visible,
            quit
        ])
        .run(tauri::generate_context!())
        .expect("error while running the app");
}
