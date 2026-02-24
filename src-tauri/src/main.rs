// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // This calls the run() function in your lib.rs
    ms_analyzer_lib::run();
}