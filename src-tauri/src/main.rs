// src-tauri/src/main.rs
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    nixos_manager_lib::run()
}
