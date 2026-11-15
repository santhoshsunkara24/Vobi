//! Vobi on screen: the little cloud with legs that stays on your screen when
//! "Keep Vobi on screen" is on.
//!
//! - Click it with nothing selected: talk (click again to stop), like the
//!   talk shortcut in toggle mode.
//! - Click it with text selected: fix the spelling; the result then offers
//!   "Refine instead".
//! - Drag it anywhere (it remembers where); right-click for Talk, Fix
//!   spelling, Refine and Hide.
//!
//! Like the recording overlay it never takes focus, so the app you're
//! writing in keeps its selection and caret. Its face follows the same
//! overlay events the pill gets (they're broadcast to every webview).

use crate::fix_selection;
use crate::managers::audio::AudioRecordingManager;
use crate::settings;
use crate::signal_handle::send_transcription_input;
use log::{debug, warn};
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::{AppHandle, Manager, WebviewUrl};

#[cfg(target_os = "macos")]
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt, PanelBuilder, PanelLevel, StyleMask,
};

/// The window's label.
pub const LABEL: &str = "vobi_buddy";
/// Window size in logical points: the cloud and its legs, with room to hop.
const SIZE: f64 = 84.0;
/// Default spot: this far in from the right edge of the screen.
const MARGIN: f64 = 24.0;

static VISIBLE: AtomicBool = AtomicBool::new(false);
/// The cursor watcher (petting) is running.
static HOVER_WATCH: AtomicBool = AtomicBool::new(false);
/// Bumped on every move, so only the last one of a drag gets saved.
static MOVE_GENERATION: AtomicU64 = AtomicU64::new(0);
/// The app the user was last in (never Vobi): a click on Vobi can bring Vobi
/// to the front, and the selection and dictation belong to that app.
static LAST_FRONT: AtomicI32 = AtomicI32::new(0);

fn remember_front() {
    let pid = fix_selection::front_app::current();
    if let Some(pid) = pid.filter(|_| !fix_selection::front_app::is_vobi(pid)) {
        LAST_FRONT.store(pid, Ordering::SeqCst);
    }
}

/// Puts the user's app back in front if the click on Vobi took it.
fn give_back_front() {
    let pid = LAST_FRONT.load(Ordering::SeqCst);
    fix_selection::front_app::give_back((pid != 0).then_some(pid));
}

#[cfg(target_os = "macos")]
tauri_panel! {
    panel!(VobiBuddyPanel {
        config: {
            can_become_key_window: false,
            becomes_key_only_if_needed: true,
            is_floating_panel: true
        }
    })
}

/// Whether Vobi is on screen right now.
pub fn is_visible() -> bool {
    VISIBLE.load(Ordering::SeqCst)
}

/// At startup: show it if the setting is on.
pub fn apply(app: &AppHandle) {
    if settings::get_settings(app).vobi_on_screen {
        set_visible(app, true);
    }
}

/// Shows or hides Vobi on screen, creating its window the first time.
pub fn set_visible(app: &AppHandle, on: bool) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if on {
            if handle.get_webview_window(LABEL).is_none() {
                create(&handle);
            }
            show(&handle);
        } else {
            hide(&handle);
        }
    });
}

/// Where it starts: where it was left, if that's still on a screen;
/// otherwise beside the Dock (bottom right of the primary screen).
fn start_position(app: &AppHandle) -> (f64, f64) {
    let saved = settings::get_settings(app).vobi_on_screen_position;
    let monitors = app.available_monitors().unwrap_or_default();
    if let Some((x, y)) = saved {
        let on_a_screen = monitors.iter().any(|m| {
            let s = m.scale_factor();
            let (mx, my) = (m.position().x as f64 / s, m.position().y as f64 / s);
            let (mw, mh) = (m.size().width as f64 / s, m.size().height as f64 / s);
            x >= mx - SIZE / 2.0
                && y >= my - SIZE / 2.0
                && x + SIZE / 2.0 <= mx + mw
                && y + SIZE / 2.0 <= my + mh
        });
        if on_a_screen {
            return (x, y);
        }
    }
    let monitor = app
        .primary_monitor()
        .ok()
        .flatten()
        .or_else(|| monitors.into_iter().next());
    match monitor {
        Some(m) => {
            let s = m.scale_factor();
            let screen_right = (m.position().x as f64 + m.size().width as f64) / s;
            let screen_bottom = (m.position().y as f64 + m.size().height as f64) / s;
            let wa = m.work_area();
            let work_bottom = (wa.position.y as f64 + wa.size.height as f64) / s;
            let x = screen_right - SIZE - MARGIN;
            // The strip the Dock (macOS) or taskbar (Windows) takes at the
            // bottom; none when it's hidden or on a side.
            let strip = screen_bottom - work_bottom;
            let y = if cfg!(target_os = "macos") && strip > 24.0 {
                // Level with the Dock, its feet on the Dock's baseline.
                work_bottom + (strip - SIZE) / 2.0
            } else {
                // Just above the taskbar or the bottom edge.
                work_bottom - SIZE - 6.0
            };
            (x, y)
        }
        None => (MARGIN, MARGIN),
    }
}

#[cfg(target_os = "macos")]
fn create(app: &AppHandle) {
    let (x, y) = start_position(app);
    let built = PanelBuilder::<_, VobiBuddyPanel>::new(app, LABEL)
        .url(WebviewUrl::App("src/buddy/index.html".into()))
        .title("Vobi")
        .position(tauri::Position::Logical(tauri::LogicalPosition { x, y }))
        // Above normal windows, under the recording pill.
        .level(PanelLevel::Floating)
        .size(tauri::Size::Logical(tauri::LogicalSize {
            width: SIZE,
            height: SIZE,
        }))
        .has_shadow(false)
        .transparent(true)
        .no_activate(true)
        .corner_radius(0.0)
        .style_mask(StyleMask::empty().borderless().nonactivating_panel())
        .with_window(|w| {
            w.decorations(false)
                .transparent(true)
                .focusable(false)
                .accept_first_mouse(true)
        })
        .collection_behavior(
            CollectionBehavior::new()
                .can_join_all_spaces()
                .full_screen_auxiliary(),
        )
        .build();
    match built {
        Ok(panel) => {
            panel.hide();
            if let Some(window) = app.get_webview_window(LABEL) {
                watch(app, &window);
            }
        }
        Err(e) => warn!("Could not create Vobi on screen: {e}"),
    }
}

#[cfg(not(target_os = "macos"))]
fn create(app: &AppHandle) {
    let (x, y) = start_position(app);
    let mut builder = tauri::WebviewWindowBuilder::new(
        app,
        LABEL,
        WebviewUrl::App("src/buddy/index.html".into()),
    )
    .title("Vobi")
    .inner_size(SIZE, SIZE)
    .position(x, y)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .closable(false)
    .decorations(false)
    .shadow(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .focusable(false)
    .focused(false)
    .accept_first_mouse(true)
    .visible(false);
    if let Some(data_dir) = crate::portable::data_dir() {
        builder = builder.data_directory(data_dir.join("webview"));
    }
    match builder.build() {
        Ok(window) => watch(app, &window),
        Err(e) => warn!("Could not create Vobi on screen: {e}"),
    }
}

/// Saves where it's dragged to, and handles its right-click menu.
fn watch(app: &AppHandle, window: &tauri::WebviewWindow) {
    let handle = app.clone();
    let win = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Moved(_) = event {
            let generation = MOVE_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
            let handle = handle.clone();
            let win = win.clone();
            // Save once it has stopped moving, not on every step of a drag.
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(400));
                if MOVE_GENERATION.load(Ordering::SeqCst) != generation {
                    return;
                }
                let (Ok(pos), Ok(scale)) = (win.outer_position(), win.scale_factor()) else {
                    return;
                };
                let mut s = settings::get_settings(&handle);
                s.vobi_on_screen_position = Some((pos.x as f64 / scale, pos.y as f64 / scale));
                settings::write_settings(&handle, s);
            });
        }
    });
    let handle = app.clone();
    window.on_menu_event(move |_window, event| {
        menu_action(&handle, event.id().as_ref());
    });
}

fn show(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    if let Ok(panel) = app.get_webview_panel(LABEL) {
        panel.show();
        VISIBLE.store(true, Ordering::SeqCst);
        watch_hover(app);
        return;
    }
    if let Some(window) = app.get_webview_window(LABEL) {
        let _ = window.show();
        VISIBLE.store(true, Ordering::SeqCst);
        watch_hover(app);
    }
}

/// What the page needs for petting: is the pointer on Vobi, where across
/// it, and did it just move (a stroke).
#[derive(serde::Serialize, Clone, Copy, PartialEq)]
struct Hover {
    over: bool,
    side: f64,
    stroke: bool,
}

/// Watches the pointer while Vobi is out. A window that never takes focus
/// doesn't reliably get hover events (macOS sends them only to the active
/// app), so this checks the cursor itself, about 20 times a second.
fn watch_hover(app: &AppHandle) {
    if HOVER_WATCH.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        let last = Arc::new(std::sync::Mutex::new((false, 0.0_f64)));
        while is_visible() {
            std::thread::sleep(Duration::from_millis(50));
            let handle = app.clone();
            let last = last.clone();
            let _ = app.run_on_main_thread(move || {
                remember_front();
                let Some(window) = handle.get_webview_window(LABEL) else {
                    return;
                };
                let (Ok(cursor), Ok(pos), Ok(size)) = (
                    handle.cursor_position(),
                    window.outer_position(),
                    window.outer_size(),
                ) else {
                    return;
                };
                let (w, h) = (size.width as f64, size.height as f64);
                // The cloud fills the middle of the window: ignore its edges.
                let inset = w * 0.12;
                let over = cursor.x >= pos.x as f64 + inset
                    && cursor.x <= pos.x as f64 + w - inset
                    && cursor.y >= pos.y as f64 + inset
                    && cursor.y <= pos.y as f64 + h - inset * 0.5;
                let side = ((cursor.x - pos.x as f64) / w * 2.0 - 1.0).clamp(-1.0, 1.0);
                let mut last = last.lock().unwrap_or_else(|e| e.into_inner());
                let (was_over, last_x) = *last;
                let stroke = over && was_over && (cursor.x - last_x).abs() > w * 0.04;
                if over != was_over || stroke {
                    let _ = tauri::Emitter::emit_to(
                        &handle,
                        LABEL,
                        "buddy-hover",
                        Hover { over, side, stroke },
                    );
                }
                *last = (over, cursor.x);
            });
        }
        HOVER_WATCH.store(false, Ordering::SeqCst);
    });
}

fn hide(app: &AppHandle) {
    VISIBLE.store(false, Ordering::SeqCst);
    #[cfg(target_os = "macos")]
    if let Ok(panel) = app.get_webview_panel(LABEL) {
        panel.hide();
        return;
    }
    if let Some(window) = app.get_webview_window(LABEL) {
        let _ = window.hide();
    }
}

fn recording(app: &AppHandle) -> bool {
    app.try_state::<Arc<AudioRecordingManager>>()
        .is_some_and(|audio| audio.is_recording())
}

/// Talk: the same as the talk shortcut, toggled.
fn talk(app: &AppHandle) {
    send_transcription_input(app, "transcribe", "vobi-on-screen");
}

/// A click: stop talking if it's listening; otherwise fix the selected text,
/// or start talking when nothing is selected.
#[tauri::command]
#[specta::specta]
pub fn buddy_click(app: AppHandle) {
    if recording(&app) {
        talk(&app);
        return;
    }
    std::thread::spawn(move || {
        give_back_front();
        match fix_selection::grab(&app) {
            Ok(Some(grabbed)) if !grabbed.text.trim().is_empty() => {
                debug!("Vobi on screen: fixing the selection");
                fix_selection::run_grabbed(&app, grabbed);
            }
            Ok(_) => talk(&app),
            Err(e) => {
                warn!("Vobi on screen: could not read the selection: {e}");
                talk(&app);
            }
        }
    });
}

/// A right-click: Talk, Fix spelling, Refine, Hide.
#[tauri::command]
#[specta::specta]
pub fn buddy_menu(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window(LABEL)
        .ok_or("Vobi isn't on screen")?;
    let locale = settings::get_settings(&app).app_language;
    let strings = crate::tray_i18n::get_tray_translations(Some(locale));
    let item = |id: &str, label: &str| MenuItem::with_id(&app, id, label, true, None::<&str>);
    let menu = Menu::with_items(
        &app,
        &[
            &item("buddy_talk", &strings.buddy_talk).map_err(|e| e.to_string())?,
            &item("buddy_fix", &strings.buddy_fix).map_err(|e| e.to_string())?,
            &item("buddy_refine", &strings.buddy_refine).map_err(|e| e.to_string())?,
            &PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?,
            &item("buddy_hide", &strings.buddy_hide).map_err(|e| e.to_string())?,
        ],
    )
    .map_err(|e| e.to_string())?;
    window.popup_menu(&menu).map_err(|e| e.to_string())
}

fn menu_action(app: &AppHandle, id: &str) {
    if matches!(id, "buddy_talk" | "buddy_fix" | "buddy_refine") {
        let app = app.clone();
        let id = id.to_string();
        std::thread::spawn(move || {
            give_back_front();
            match id.as_str() {
                "buddy_talk" => talk(&app),
                "buddy_fix" => fix_selection::run(&app),
                _ => fix_selection::run_refine(&app),
            }
        });
        return;
    }
    match id {
        "buddy_hide" => {
            let mut s = settings::get_settings(app);
            s.vobi_on_screen = false;
            settings::write_settings(app, s);
            set_visible(app, false);
            // Keep the settings window's switch in step.
            let _ = tauri::Emitter::emit(
                app,
                "settings-changed",
                serde_json::json!({ "setting": "vobi_on_screen" }),
            );
        }
        _ => {}
    }
}
