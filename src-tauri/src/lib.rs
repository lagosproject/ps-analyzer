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
                        ("samtools", "BIO_SAMTOOLS_PATH", "--samtools-path"),
                        ("bgzip", "BIO_BGZIP_PATH", "--bgzip-path"),
                    ];

                    for (name, env_var, arg) in tools {
                        let sidecar_id = format!("ps-analyzer-{}", name);
                        // 1. Try to find it as a sidecar in resources (standard triple-suffixed name)
                        let sidecar_path = path_resolver.join(format!("binaries/{}-{}", sidecar_id, target_triple));
                        
                        // 2. Fallback to flattened name in resources
                        let mut final_path = if sidecar_path.exists() {
                            sidecar_path
                        } else {
                            path_resolver.join(format!("binaries/{}", sidecar_id))
                        };

                        // 3. Fallback to executable directory (common for Linux packages)
                        if !final_path.exists() {
                            if let Ok(exe_dir) = app_handle.path().executable_dir() {
                                let exe_sidecar = exe_dir.join(&sidecar_id);
                                if exe_sidecar.exists() {
                                    final_path = exe_sidecar;
                                }
                            }
                        }

                        if final_path.exists() {
                            println!("Redirecting bio-engine to use {} at: {:?}", name, final_path);
                            sidecar_command = sidecar_command
                                .env(env_var, final_path.to_string_lossy().to_string())
                                .args([arg, &final_path.to_string_lossy()]);
                        } else {
                            // 4. Fallback for development where binaries might be in src-tauri/binaries
                            let dev_path = std::env::current_dir()
                                .unwrap_or_default()
                                .join(format!("src-tauri/binaries/{}-{}", sidecar_id, target_triple));
                            if dev_path.exists() {
                                println!("Development: Redirecting bio-engine to use {} at: {:?}", name, dev_path);
                                sidecar_command = sidecar_command
                                    .env(env_var, dev_path.to_string_lossy().to_string())
                                    .args([arg, &dev_path.to_string_lossy()]);
                            }
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