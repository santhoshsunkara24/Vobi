//! "Fix selection": select text in any app, press the shortcut, and Vobi
//! corrects the spelling in place, then says what it changed in the pill.

use crate::clipboard::{copy_selection, replace_selection};
use crate::input::wait_for_modifiers_released;
use crate::overlay::{show_fix_result, FixResult};
use crate::settings::get_settings;
use crate::spellfix;
use log::{info, warn};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::AppHandle;

/// One fix at a time: a second press while one is running is ignored.
static RUNNING: AtomicBool = AtomicBool::new(false);

pub fn run(app: &AppHandle) {
    if RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    let spawned = std::thread::Builder::new()
        .name("fix-selection".into())
        .spawn(move || {
            let result = fix(&app);
            show_fix_result(&app, result);
            RUNNING.store(false, Ordering::SeqCst);
        });
    if let Err(e) = spawned {
        warn!("Could not start fix-selection: {e}");
        RUNNING.store(false, Ordering::SeqCst);
    }
}

fn fix(app: &AppHandle) -> FixResult {
    // Let go of the shortcut's keys first, so our Cmd+C isn't Cmd+Shift+Option+C.
    wait_for_modifiers_released(Duration::from_millis(1500));
    std::thread::sleep(Duration::from_millis(40));

    let selected = match copy_selection(app) {
        Ok(Some(text)) => text,
        Ok(None) => return FixResult::NothingSelected,
        Err(e) => {
            warn!("Fix selection: could not copy the selection: {e}");
            return FixResult::Failed;
        }
    };

    let custom_words = get_settings(app).custom_words;
    let result = spellfix::correct(&selected, &custom_words);
    if result.fixes.is_empty() {
        return FixResult::Clean;
    }
    info!("Fix selection: {} correction(s)", result.fixes.len());
    match replace_selection(app, &result.text) {
        Ok(()) => FixResult::Fixed(result.fixes),
        Err(e) => {
            warn!("Fix selection: could not replace the selection: {e}");
            FixResult::Failed
        }
    }
}
