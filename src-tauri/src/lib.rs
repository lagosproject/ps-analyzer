use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            tauri::async_runtime::spawn(async move {
                let mut sidecar_command = app_handle
                    .shell()
                    .sidecar("bio-engine")
                    .expect("failed to create sidecar");

                // Resolve tracy sidecar path to pass it to the bio-engine
                let target_triple = if cfg!(target_os = "linux") {
                    "x86_64-unknown-linux-gnu"
                } else if cfg!(target_os = "windows") {
                    "x86_64-pc-windows-msvc"
                } else {
                    "unknown"
                };
                if let Ok(path_resolver) = app_handle.path().resource_dir() {
                    let tracy_path = path_resolver.join(format!("binaries/tracy-{}", target_triple));
                    if tracy_path.exists() {
                        println!("Redirecting bio-engine to use tracy at: {:?}", tracy_path);
                        sidecar_command = sidecar_command
                            .env("TRACY_PATH", tracy_path.to_string_lossy().to_string())
                            .args(["--tracy-path", &tracy_path.to_string_lossy()]);
                    } else {
                        // Fallback for development where binaries might be in src-tauri/binaries
                        let dev_tracy_path = std::env::current_dir()
                            .unwrap_or_default()
                            .join(format!("src-tauri/binaries/tracy-{}", target_triple));
                        if dev_tracy_path.exists() {
                           println!("Development: Redirecting bio-engine to use tracy at: {:?}", dev_tracy_path);
                           sidecar_command = sidecar_command
                               .env("TRACY_PATH", dev_tracy_path.to_string_lossy().to_string())
                               .args(["--tracy-path", &dev_tracy_path.to_string_lossy()]);
                        }
                    }
                }

                let (mut rx, _child) = sidecar_command
                    .spawn()
                    .expect("failed to spawn sidecar");

                // Monitor the sidecar output
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("Python: {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            let error_msg = String::from_utf8_lossy(&line);
                            eprintln!("Python Error: {}", error_msg);
                            if error_msg.contains("address already in use") {
                                eprintln!("CRITICAL: Port 8000 is occupied. Please ensure no other PS Analyzer instance is running.");
                            }
                        }
                        CommandEvent::Terminated(payload) => {
                            println!("Python sidecar terminated with code: {:?}", payload.code);
                            break;
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!()) // Use .build() instead of .run() to get access to events
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            // This captures the Global Exit event
            if let tauri::RunEvent::Exit = event {
                // Tauri v2 automatically attempts to kill child processes 
                // spawned via the shell plugin on Exit, but this confirms it.
                println!("Application exiting, cleaning up processes...");
            }
        });
}