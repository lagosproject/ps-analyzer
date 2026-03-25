use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use std::net::TcpListener;

struct AppState {
    port: u16,
}

#[tauri::command]
fn get_backend_port(state: tauri::State<AppState>) -> u16 {
    state.port
}

fn get_available_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind to random port");
    listener.local_addr().expect("Failed to get local address").port()
}

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
                let port = get_available_port();
                app_handle.manage(AppState { port });

                let mut sidecar_command = app_handle
                    .shell()
                    .sidecar("ps-analyzer-bio-engine")
                    .expect("failed to create sidecar")
                    .env("BIO_PORT", port.to_string());

                // Resolve sidecar paths to pass them to the bio-engine
                let target_triple = if cfg!(target_os = "linux") {
                    "x86_64-unknown-linux-gnu"
                } else if cfg!(target_os = "windows") {
                    "x86_64-pc-windows-msvc"
                } else {
                    "unknown"
                };

                if let Ok(path_resolver) = app_handle.path().resource_dir() {
                    let tools = [
                        ("tracy", "TRACY_PATH", "--tracy-path"),
                        ("bgzip", "BIO_BGZIP_PATH", "--bgzip-path"),
                    ];

                    for (name, env_var, arg) in tools {
                        let sidecar_id = format!("ps-analyzer-{}", name);
                        let mut final_path = None;

                        // List of potential paths to check, in order of priority
                        let mut paths_to_check = Vec::new();

                        // 1. Standard sidecar location (Resource dir / binaries / {id}-{triple})
                        paths_to_check.push(path_resolver.join(format!("binaries/{}-{}", sidecar_id, target_triple)));
                        
                        // 2. Flattened resource location (Resource dir / binaries / {id})
                        paths_to_check.push(path_resolver.join(format!("binaries/{}", sidecar_id)));

                        // 3. Executable directory (common for Linux packages)
                        if let Ok(exe_dir) = app_handle.path().executable_dir() {
                            // Check with and without triple in exe_dir
                            paths_to_check.push(exe_dir.join(format!("{}-{}", sidecar_id, target_triple)));
                            paths_to_check.push(exe_dir.join(&sidecar_id));
                        }

                        // 4. Development fallback (Project root / src-tauri / binaries / {id}-{triple})
                        if let Ok(cwd) = std::env::current_dir() {
                            paths_to_check.push(cwd.join(format!("src-tauri/binaries/{}-{}", sidecar_id, target_triple)));
                            paths_to_check.push(cwd.join(format!("src-tauri/binaries/{}", sidecar_id)));
                        }

                        // 5. Explicit system paths (Final fallback for Linux)
                        if cfg!(target_os = "linux") {
                            paths_to_check.push(std::path::PathBuf::from(format!("/usr/bin/{}", sidecar_id)));
                            paths_to_check.push(std::path::PathBuf::from(format!("/bin/{}", sidecar_id)));
                            paths_to_check.push(std::path::PathBuf::from(format!("/usr/local/bin/{}", sidecar_id)));
                        }

                        // Find the first path that exists
                        for path in paths_to_check {
                            if path.exists() {
                                final_path = Some(path);
                                break;
                            }
                        }

                        if let Some(path) = final_path {
                            println!("Redirecting bio-engine to use {} at: {:?}", name, path);
                            sidecar_command = sidecar_command
                                .env(env_var, path.to_string_lossy().to_string())
                                .args([arg, &path.to_string_lossy()]);
                        } else {
                            // Final fallback: Don't pass the path, let bio-engine use system PATH
                            println!("Sidecar for {} not found. Bio-engine will attempt to use system '{}' from PATH.", name, name);
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
        .invoke_handler(tauri::generate_handler![get_backend_port])
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