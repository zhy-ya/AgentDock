fn main() {
    // Ensure icon updates trigger a rebuild in `tauri dev`.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
