fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "set_close_to_tray",
                "set_launch_on_startup",
                "exit_app",
                "check_for_update",
                "install_update",
            ]),
        ),
    )
    .expect("failed to build Prismeter Tauri manifest")
}
