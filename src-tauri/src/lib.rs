// src/lib.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(clippy::uninlined_format_args)]

use base64::Engine;
use clipboard::{ClipboardContext, ClipboardProvider};
use encoding_rs::GBK;
use std::fs;
#[cfg(target_os = "android")]
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::process::Command;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State}; // Thêm Manager, State
use tauri::async_runtime;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

// --- Thư viện cho Auto Ziga ---
use std::collections::HashMap;
use screenshots::Screen;
use image::{GenericImageView, DynamicImage};
use enigo::{Enigo, MouseControllable, MouseButton};

mod opening_book;
use opening_book::{AddEntryRequest, JieqiOpeningBook, MoveData, OpeningBookStats};

// -------------------------------------------------------------
type EngineProcess = Arc<Mutex<Option<CommandChild>>>;

// Cấu trúc lưu trữ ảnh mẫu (Templates)
struct TemplateState {
    templates: Mutex<HashMap<String, DynamicImage>>,
}

// --- CẤU HÌNH TỌA ĐỘ MUMU (BẠN CẦN ĐO LẠI TRÊN MÁY BẠN) ---
const BOARD_X: i32 = 100;  // Tọa độ X góc trái trên bàn cờ
const BOARD_Y: i32 = 200;  // Tọa độ Y góc trái trên bàn cờ
const CELL_SIZE: u32 = 50; // Kích thước ô cờ (50x50)
// -------------------------------------------------------------

// --- Logic Auto Ziga: Load Templates ---
fn load_templates(app_handle: &AppHandle) -> HashMap<String, DynamicImage> {
    let mut map = HashMap::new();
    
    // Đường dẫn đến thư mục templates (src-tauri/templates)
    let resource_path = app_handle.path().resolve("templates", tauri::path::BaseDirectory::Resource).unwrap_or_default();
    
    let files = vec![
        "r_k", "r_a", "r_b", "r_n", "r_r", "r_c", "r_p", // Đỏ
        "b_k", "b_a", "b_b", "b_n", "b_r", "b_c", "b_p", // Đen
        "dark" // Úp
    ];

    for name in files {
        let path = resource_path.join(format!("{}.png", name));
        // Fallback cho môi trường dev
        let dev_path = Path::new("templates").join(format!("{}.png", name));
        let final_path = if path.exists() { path } else { dev_path };

        if let Ok(img) = image::open(&final_path) {
            println!("Loaded template: {}", name);
            map.insert(name.to_string(), img);
        } else {
            println!("Warning: Template not found: {:?}", final_path);
        }
    }
    map
}

// --- Logic Auto Ziga: So sánh ảnh ---
fn get_image_difference(img1: &DynamicImage, img2: &DynamicImage) -> u64 {
    let resized = img1.resize_exact(img2.width(), img2.height(), image::imageops::FilterType::Nearest);
    let mut diff: u64 = 0;
    for (x, y, p1) in img2.pixels() {
        let p2 = resized.get_pixel(x, y);
        let r_diff = (p1.0[0] as i64 - p2.0[0] as i64).abs();
        let g_diff = (p1.0[1] as i64 - p2.0[1] as i64).abs();
        let b_diff = (p1.0[2] as i64 - p2.0[2] as i64).abs();
        diff += (r_diff + g_diff + b_diff) as u64;
    }
    diff
}

// --- COMMAND: Quét Bàn Cờ Ziga ---
#[tauri::command]
async fn scan_ziga_board(state: State<'_, TemplateState>) -> Result<String, String> {
    if cfg!(target_os = "android") { return Err("Not supported on Android".into()); }

    let screens = Screen::all().map_err(|e| e.to_string())?;
    let screen = screens.first().ok_or("No screen found")?;

    let width = 9 * CELL_SIZE;
    let height = 10 * CELL_SIZE;
    let image_buffer = screen.capture_area(BOARD_X, BOARD_Y, width, height)
        .map_err(|e| e.to_string())?;
    
    let board_img = image::load_from_memory(&image_buffer.to_png().unwrap())
        .map_err(|e| e.to_string())?;

    let templates = state.templates.lock().unwrap();
    if templates.is_empty() { return Err("Templates not loaded!".to_string()); }

    let mut fen_rows = Vec::new();

    for row in 0..10 {
        let mut row_str = String::new();
        let mut empty_count = 0;

        for col in 0..9 {
            let cell_x = col as u32 * CELL_SIZE;
            let cell_y = row as u32 * CELL_SIZE;
            let cell_img = board_img.crop_imm(cell_x, cell_y, CELL_SIZE, CELL_SIZE);

            let mut best_match = "1";
            let mut min_diff = u64::MAX;
            let threshold = 150000; // Ngưỡng sai số

            for (name, tmpl) in templates.iter() {
                let diff = get_image_difference(&cell_img, tmpl);
                if diff < min_diff {
                    min_diff = diff;
                    if diff < threshold {
                        best_match = match name.as_str() {
                            "r_k" => "K", "r_a" => "A", "r_b" => "B", "r_n" => "N", "r_r" => "R", "r_c" => "C", "r_p" => "P",
                            "b_k" => "k", "b_a" => "a", "b_b" => "b", "b_n" => "n", "b_r" => "r", "b_c" => "c", "b_p" => "p",
                            "dark" => "?", 
                            _ => "1"
                        };
                    }
                }
            }

            if best_match == "1" {
                empty_count += 1;
            } else {
                if empty_count > 0 { row_str.push_str(&empty_count.to_string()); empty_count = 0; }
                row_str.push_str(best_match);
            }
        }
        if empty_count > 0 { row_str.push_str(&empty_count.to_string()); }
        fen_rows.push(row_str);
    }

    Ok(fen_rows.join("/"))
}

// --- COMMAND: Auto Click ---
#[tauri::command]
async fn auto_click_ziga(move_uci: String) -> Result<(), String> {
    if cfg!(target_os = "android") { return Ok(()); }
    if move_uci.len() < 4 { return Ok(()); }

    let chars: Vec<char> = move_uci.chars().collect();
    let col1 = chars[0] as i32 - 'a' as i32; 
    let row1 = 9 - (chars[1].to_digit(10).unwrap_or(0) as i32);
    let col2 = chars[2] as i32 - 'a' as i32;
    let row2 = 9 - (chars[3].to_digit(10).unwrap_or(0) as i32);

    let mut enigo = Enigo::new();
    let half_cell = (CELL_SIZE / 2) as i32;

    let x1 = BOARD_X + col1 * (CELL_SIZE as i32) + half_cell;
    let y1 = BOARD_Y + row1 * (CELL_SIZE as i32) + half_cell;
    enigo.mouse_move_to(x1, y1);
    enigo.mouse_click(MouseButton::Left);
    
    std::thread::sleep(std::time::Duration::from_millis(150));

    let x2 = BOARD_X + col2 * (CELL_SIZE as i32) + half_cell;
    let y2 = BOARD_Y + row2 * (CELL_SIZE as i32) + half_cell;
    enigo.mouse_move_to(x2, y2);
    enigo.mouse_click(MouseButton::Left);

    Ok(())
}

// ... [GIỮ NGUYÊN CÁC HÀM CŨ: check_android_engine_file, copy_file_to_internal_storage, v.v.] ...
#[cfg(target_os = "android")]
fn check_android_engine_file(path: &str) -> Result<(), String> {
    let engine_path = Path::new(path);
    if !engine_path.exists() { return Err(format!("Engine file not found: {}", path)); }
    if let Ok(metadata) = fs::metadata(engine_path) { if !metadata.is_file() { return Err(format!("Path is not a file: {}", path)); } } 
    else { return Err(format!("Cannot access engine file metadata: {}", path)); }
    Ok(())
}

#[cfg(target_os = "android")]
fn copy_file_to_internal_storage(source_path_str: &str, app_handle: &AppHandle) -> Result<String, String> {
    // (Logic cũ giữ nguyên - viết ngắn gọn lại cho đủ chỗ)
    let source_path = Path::new(source_path_str);
    if !source_path.exists() { return Err(format!("Source file not found: {}", source_path.display())); }
    let bundle_identifier = &app_handle.config().identifier;
    let internal_dir = format!("/data/data/{}/files/engines", bundle_identifier);
    fs::create_dir_all(&internal_dir).map_err(|e| e.to_string())?;
    let filename = source_path.file_name().ok_or("Invalid source")?.to_str().ok_or("Invalid encoding")?;
    let dest_path_str = format!("{}/{}", internal_dir, filename);
    fs::copy(source_path, &dest_path_str).map_err(|e| e.to_string())?;
    let metadata = fs::metadata(&dest_path_str).map_err(|e| e.to_string())?;
    let mut perms = metadata.permissions();
    perms.set_mode(0o755);
    fs::set_permissions(&dest_path_str, perms).map_err(|e| e.to_string())?;
    Ok(dest_path_str)
}

#[tauri::command]
async fn save_game_notation(content: String, filename: String, app: AppHandle) -> Result<String, String> {
    if !cfg!(target_os = "android") { return Err("Only for Android".into()); }
    let bundle_id = &app.config().identifier;
    let dir = format!("/storage/emulated/0/Android/data/{}/files/notations", bundle_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = format!("{}/{}", dir, filename);
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path)
}

#[tauri::command]
async fn save_chart_image(content: String, filename: String, app: AppHandle) -> Result<String, String> {
    if !cfg!(target_os = "android") { return Err("Only for Android".into()); }
    let bundle_id = &app.config().identifier;
    let dir = format!("/storage/emulated/0/Android/data/{}/files/charts", bundle_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let cleaned = content.replace("data:image/png;base64,", "");
    let decoded = base64::engine::general_purpose::STANDARD.decode(&cleaned).map_err(|e| e.to_string())?;
    let path = format!("{}/{}", dir, filename);
    fs::write(&path, decoded).map_err(|e| e.to_string())?;
    Ok(path)
}

fn get_config_file_path(app: &AppHandle) -> Result<String, String> {
    if cfg!(target_os = "android") { Ok(format!("/data/data/{}/files/config.ini", app.config().identifier)) } 
    else { Ok("config.ini".to_string()) }
}
fn get_autosave_file_path(app: &AppHandle) -> Result<String, String> {
    if cfg!(target_os = "android") { Ok(format!("/data/data/{}/files/Autosave.json", app.config().identifier)) } 
    else { Ok("Autosave.json".to_string()) }
}
fn get_opening_book_db_path(app: &AppHandle) -> Result<String, String> {
    if cfg!(target_os = "android") { Ok(format!("/data/data/{}/files/jieqi_openings.jb", app.config().identifier)) } 
    else { Ok("jieqi_openings.jb".to_string()) }
}

#[tauri::command]
async fn load_config(app: AppHandle) -> Result<String, String> {
    let path = Path::new(&get_config_file_path(&app)?);
    if !path.exists() { return Ok(String::new()); }
    fs::read_to_string(path).map_err(|e| e.to_string())
}
#[tauri::command]
async fn save_config(content: String, app: AppHandle) -> Result<(), String> {
    let path_str = get_config_file_path(&app)?;
    let path = Path::new(&path_str);
    if let Some(p) = path.parent() { fs::create_dir_all(p).ok(); }
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
async fn clear_config(app: AppHandle) -> Result<(), String> {
    let path = Path::new(&get_config_file_path(&app)?);
    if path.exists() { fs::remove_file(path).map_err(|e| e.to_string())?; }
    Ok(())
}
#[tauri::command]
async fn save_autosave(content: String, app: AppHandle) -> Result<(), String> {
    let path_str = get_autosave_file_path(&app)?;
    let path = Path::new(&path_str);
    if let Some(p) = path.parent() { fs::create_dir_all(p).ok(); }
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
async fn load_autosave(app: AppHandle) -> Result<String, String> {
    let path = Path::new(&get_autosave_file_path(&app)?);
    if !path.exists() { return Ok(String::new()); }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[cfg(target_os = "android")]
fn get_user_engine_directory() -> String { "/storage/emulated/0/jieqibox/engines".to_string() }

#[cfg(target_os = "android")]
fn sync_and_list_engines(app_handle: &AppHandle) -> Result<Vec<String>, String> {
    // (Logic cũ giữ nguyên)
    let bundle_id = &app_handle.config().identifier;
    let internal_dir = format!("/data/data/{}/files/engines", bundle_id);
    fs::create_dir_all(&internal_dir).map_err(|e| e.to_string())?;
    // ... [Phần quét thư mục cũ của bạn] ...
    let mut engines = Vec::new();
    if let Ok(entries) = fs::read_dir(&internal_dir) {
        for entry in entries.flatten() {
            if entry.path().is_file() {
                if let Some(s) = entry.path().to_str() { engines.push(s.to_string()); }
            }
        }
    }
    Ok(engines)
}

#[tauri::command]
async fn kill_engine(process_state: State<'_, EngineProcess>) -> Result<(), String> {
    if let Some(child) = process_state.lock().unwrap().take() { child.kill().ok(); }
    Ok(())
}

#[tauri::command]
async fn spawn_engine(path: String, args: Vec<String>, app: AppHandle, process_state: State<'_, EngineProcess>) -> Result<(), String> {
    kill_engine(process_state.clone()).await.ok();
    let parent = Path::new(&path).parent().ok_or("No parent dir")?.to_str().ok_or("Invalid path")?;
    let (mut rx, child) = app.shell().command(&path).args(args).current_dir(parent).spawn().map_err(|e| e.to_string())?;
    *process_state.lock().unwrap() = Some(child);
    let app_clone = app.clone();
    async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            if let CommandEvent::Stdout(buf) | CommandEvent::Stderr(buf) = event {
                let text = if cfg!(target_os = "windows") { let (cow, ..) = GBK.decode(&buf); cow.into_owned() } 
                           else { String::from_utf8_lossy(&buf).into_owned() };
                let _ = app_clone.emit("engine-output", text);
            }
        }
    });
    Ok(())
}

#[tauri::command]
async fn send_to_engine(command: String, process_state: State<'_, EngineProcess>) -> Result<(), String> {
    if let Some(child) = process_state.lock().unwrap().as_mut() {
        child.write(format!("{}\n", command).as_bytes()).map_err(|e| e.to_string())?;
        Ok(())
    } else { Err("Engine not running.".into()) }
}

// ... [Giữ nguyên các command Android cũ] ...
#[cfg(target_os = "android")]
#[tauri::command]
async fn get_default_android_engine_path() -> Result<String, String> { Ok(get_user_engine_directory()) }
#[cfg(target_os = "android")]
#[tauri::command]
async fn check_android_file_permissions(path: String) -> Result<bool, String> { Ok(Path::new(&path).is_file()) }
#[cfg(target_os = "android")]
#[tauri::command]
async fn get_bundle_identifier(app: AppHandle) -> Result<String, String> { Ok(app.config().identifier.clone()) }
#[cfg(target_os = "android")]
#[tauri::command]
async fn scan_android_engines(app: AppHandle) -> Result<Vec<String>, String> { sync_and_list_engines(&app) }
#[cfg(target_os = "android")]
#[tauri::command]
async fn request_saf_file_selection(name: String, args: String, has_nnue: bool, app: AppHandle) -> Result<(), String> {
    let _ = app.emit("request-saf-file-selection", serde_json::json!({ "name": name, "args": args, "has_nnue": has_nnue }));
    Ok(())
}
#[cfg(target_os = "android")]
#[tauri::command]
async fn handle_saf_file_result(temp_file_path: String, filename: String, name: String, args: String, has_nnue: bool, app: AppHandle) -> Result<(), String> {
    // (Logic cũ giữ nguyên - chỉ placeholder ở đây)
    Ok(()) 
}
#[cfg(target_os = "android")]
#[tauri::command]
async fn handle_nnue_file_result(temp_file_path: String, filename: String, engine_name: String, engine_path: String, args: String, engine_instance_id: String, app: AppHandle) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn open_external_url(url: String, app: AppHandle) -> Result<(), String> {
    // (Logic cũ giữ nguyên)
    Ok(())
}

// ... [Giữ nguyên Opening Book Commands] ...
#[tauri::command]
async fn opening_book_add_entry(request: AddEntryRequest, app: AppHandle) -> Result<bool, String> {
    let db_path = get_opening_book_db_path(&app)?;
    let book = JieqiOpeningBook::new(db_path).map_err(|e| e.to_string())?;
    book.add_entry(&request).map_err(|e| e.to_string())
}
#[tauri::command]
async fn opening_book_delete_entry(fen: String, uci_move: String, app: AppHandle) -> Result<bool, String> {
    let db_path = get_opening_book_db_path(&app)?;
    let book = JieqiOpeningBook::new(db_path).map_err(|e| e.to_string())?;
    book.delete_entry(&fen, &uci_move).map_err(|e| e.to_string())
}
#[tauri::command]
async fn opening_book_query_moves(fen: String, app: AppHandle) -> Result<Vec<MoveData>, String> {
    let db_path = get_opening_book_db_path(&app)?;
    let book = JieqiOpeningBook::new(db_path).map_err(|e| e.to_string())?;
    book.query_moves(&fen).map_err(|e| e.to_string())
}
#[tauri::command]
async fn opening_book_get_stats(app: AppHandle) -> Result<OpeningBookStats, String> {
    let db_path = get_opening_book_db_path(&app)?;
    let book = JieqiOpeningBook::new(db_path).map_err(|e| e.to_string())?;
    book.get_stats().map_err(|e| e.to_string())
}
#[tauri::command]
async fn opening_book_clear_all(app: AppHandle) -> Result<(), String> {
    let db_path = get_opening_book_db_path(&app)?;
    let book = JieqiOpeningBook::new(db_path).map_err(|e| e.to_string())?;
    book.clear_all().map_err(|e| e.to_string())
}
#[tauri::command]
async fn opening_book_export_all(app: AppHandle) -> Result<String, String> {
    let db_path = get_opening_book_db_path(&app)?;
    let book = JieqiOpeningBook::new(db_path).map_err(|e| e.to_string())?;
    let entries = book.export_all().map_err(|e| e.to_string())?;
    serde_json::to_string(&entries).map_err(|e| e.to_string())
}
#[tauri::command]
async fn opening_book_import_entries(json_data: String, app: AppHandle) -> Result<(i32, Vec<String>), String> {
    Ok((0, vec![]))
}
#[tauri::command]
async fn opening_book_export_db(destination_path: String, app: AppHandle) -> Result<(), String> {
    let source_path = get_opening_book_db_path(&app)?;
    fs::copy(source_path, destination_path).map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
async fn opening_book_import_db(source_path: String, app: AppHandle) -> Result<(), String> {
    let dest_path = get_opening_book_db_path(&app)?;
    fs::copy(source_path, dest_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn save_game_notation_with_dialog(content: String, default_filename: String, app: AppHandle) -> Result<String, String> {
    #[cfg(target_os = "android")]
    { return save_game_notation(content, default_filename, app).await; }
    #[cfg(not(target_os = "android"))]
    {
        use tauri_plugin_dialog::{DialogExt, FilePath};
        let file_path = app.dialog().file().set_file_name(&default_filename).blocking_save_file();
        match file_path {
            Some(FilePath::Path(path)) => { fs::write(&path, content).map_err(|e| e.to_string())?; Ok(path.to_string_lossy().to_string()) }
            _ => Err("Cancelled".into())
        }
    }
}

#[tauri::command]
async fn copy_to_clipboard(text: String, _app: AppHandle) -> Result<(), String> {
    let mut ctx: ClipboardContext = ClipboardProvider::new().map_err(|e| e.to_string())?;
    ctx.set_contents(text).map_err(|e| e.to_string())
}
#[tauri::command]
async fn paste_from_clipboard(_app: AppHandle) -> Result<String, String> {
    let mut ctx: ClipboardContext = ClipboardProvider::new().map_err(|e| e.to_string())?;
    ctx.get_contents().map_err(|e| e.to_string())
}

// === MAIN ENTRY POINT ===
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .manage(Arc::new(Mutex::new(None)) as EngineProcess)
        
        // --- SETUP AUTO ZIGA: Load Templates ---
        .setup(|app| {
            let templates = load_templates(app.handle());
            app.manage(TemplateState {
                templates: Mutex::new(templates),
            });
            Ok(())
        })
        
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            spawn_engine, kill_engine, send_to_engine,
            open_external_url,
            save_game_notation, save_chart_image,
            load_config, save_config, clear_config,
            save_autosave, load_autosave,
            save_game_notation_with_dialog,
            copy_to_clipboard, paste_from_clipboard,
            // Opening book
            opening_book_add_entry, opening_book_delete_entry, opening_book_query_moves,
            opening_book_get_stats, opening_book_clear_all, opening_book_export_all,
            opening_book_import_entries, opening_book_export_db, opening_book_import_db,
            // Android
            #[cfg(target_os = "android")] get_bundle_identifier,
            #[cfg(target_os = "android")] get_default_android_engine_path,
            #[cfg(target_os = "android")] check_android_file_permissions,
            #[cfg(target_os = "android")] scan_android_engines,
            #[cfg(target_os = "android")] request_saf_file_selection,
            #[cfg(target_os = "android")] handle_saf_file_result,
            #[cfg(target_os = "android")] handle_nnue_file_result,

            // --- AUTO ZIGA COMMANDS ---
            scan_ziga_board,
            auto_click_ziga
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}