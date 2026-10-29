mod safety;
mod store;

use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, State, WindowEvent};

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
            // Without a database no other part of the app starts (the popup timer comes later).
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
            Ok(())
        })
        .on_window_event(|window, event| {
            if let (WindowEvent::CloseRequested { api, .. }, "main") = (event, window.label()) {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            add_category,
            list_categories,
            remove_category,
            get_settings,
            save_settings,
            startup_failure,
            start_empty,
            restore_latest_backup,
            show_backups_folder,
            quit
        ])
        .run(tauri::generate_context!())
        .expect("error while running the app");
}
