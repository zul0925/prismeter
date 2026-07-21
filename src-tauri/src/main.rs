#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend;
mod codex;
mod credential;
mod mimo;
mod notifications;
mod volcengine;

use std::{
    path::PathBuf,
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder,
};

#[derive(Clone)]
struct ClosePreference(Arc<AtomicBool>);

impl Default for ClosePreference {
    fn default() -> Self { Self(Arc::new(AtomicBool::new(true))) }
}

#[tauri::command]
fn set_close_to_tray(value: bool, preference: State<'_, ClosePreference>) {
    preference.0.store(value, Ordering::Relaxed);
}

#[cfg(target_os = "windows")]
fn update_startup_registry(value: bool) -> Result<(), String> {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
    let mut command = Command::new("reg.exe");
    command.creation_flags(CREATE_NO_WINDOW).stdout(Stdio::null()).stderr(Stdio::null());
    if value {
        let executable = std::env::current_exe().map_err(|error| format!("无法定位 Prismeter：{error}"))?;
        let startup_value = startup_command_value(&executable);
        command.args(["add", RUN_KEY, "/v", "Prismeter", "/t", "REG_SZ", "/d"])
            .arg(startup_value)
            .arg("/f");
        let status = command.status().map_err(|error| format!("无法写入 Windows 启动项：{error}"))?;
        if status.success() { Ok(()) } else { Err("Windows 拒绝写入 Prismeter 启动项".into()) }
    } else {
        command.args(["delete", RUN_KEY, "/v", "Prismeter", "/f"]);
        let status = command.status().map_err(|error| format!("无法移除 Windows 启动项：{error}"))?;
        if status.success() { return Ok(()); }
        let query = Command::new("reg.exe")
            .args(["query", RUN_KEY, "/v", "Prismeter"])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|error| format!("无法检查 Windows 启动项：{error}"))?;
        if query.success() { Err("Windows 拒绝移除 Prismeter 启动项".into()) } else { Ok(()) }
    }
}

fn startup_command_value(executable: &std::path::Path) -> String {
    format!("\"{}\" --background", executable.display())
}

#[cfg(not(target_os = "windows"))]
fn update_startup_registry(_value: bool) -> Result<(), String> {
    Err("开机启动仅支持 Windows".into())
}

#[tauri::command]
fn set_launch_on_startup(value: bool) -> Result<(), String> { update_startup_registry(value) }

#[tauri::command]
fn exit_app(app: AppHandle) { app.exit(0); }

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn legacy_data_dir() -> Result<PathBuf, String> {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .map(|path| path.join("Prismeter").join("Data"))
        .ok_or_else(|| "无法定位 Windows 本地数据目录。".to_string())
}

fn main() {
    let start_in_background = std::env::args().any(|argument| argument == "--background");
    tauri::Builder::default()
        .manage(ClosePreference::default())
        .invoke_handler(tauri::generate_handler![set_close_to_tray, set_launch_on_startup, exit_app])
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if !args.iter().any(|argument| argument == "--background") { show_main(app); }
        }))
        .setup(move |app| {
            let backend_url = backend::start(legacy_data_dir()?)?;

            let window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(backend_url.parse::<url::Url>()?),
            )
            .title("Prismeter")
            .decorations(false)
            .visible(!start_in_background)
            .maximized(!start_in_background)
            .min_inner_size(980.0, 680.0)
            .build()?;

            let close_window = window.clone();
            let close_to_tray = app.state::<ClosePreference>().0.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if close_to_tray.load(Ordering::Relaxed) {
                        let _ = close_window.hide();
                    } else {
                        close_window.app_handle().exit(0);
                    }
                }
            });

            let open_item = MenuItemBuilder::with_id("open", "打开 Prismeter").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出 Prismeter").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&open_item, &quit_item]).build()?;
            let tray = TrayIconBuilder::new()
                .tooltip("Prismeter · AI 用量中心")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event {
                        show_main(tray.app_handle());
                    }
                });
            let tray = if let Some(icon) = app.default_window_icon() {
                tray.icon(icon.clone())
            } else {
                tray
            };
            tray.build(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Prismeter Tauri initialization failed")
        .run(|_, _| {});
}

#[cfg(test)]
mod desktop_tests {
    use super::*;

    #[test]
    fn startup_command_quotes_paths_and_starts_in_background() {
        let value = startup_command_value(std::path::Path::new(r"C:\Program Files\Prismeter\prismeter.exe"));
        assert_eq!(value, r#""C:\Program Files\Prismeter\prismeter.exe" --background"#);
    }
}
