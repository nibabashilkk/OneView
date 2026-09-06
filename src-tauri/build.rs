fn main() {
    println!("cargo:rerun-if-env-changed=MDV_UPDATE_ENDPOINT");
    println!("cargo:rerun-if-env-changed=MDV_UPDATE_PUBKEY");
    tauri_build::build()
}
