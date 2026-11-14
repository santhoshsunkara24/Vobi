//! "Fix selection": select text in any app, press the shortcut, and Vobi
//! corrects the spelling in place, then says what it changed in the pill.

use crate::actions::{post_process_transcription, PostProcessOutcome};
use crate::clipboard::{copy_selection, replace_selection};
use crate::input::wait_for_modifiers_released;
use crate::overlay::{show_fix_result, show_refining_overlay, FixResult};
use crate::settings::{
    get_settings, AppSettings, APPLE_INTELLIGENCE_PROVIDER_ID, GROQ_DEFAULT_MODEL,
    VOBI_REFINE_PROMPT_ID,
};
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

/// "Refine selection": rewrite the selected text with the AI and put it back.
pub fn run_refine(app: &AppHandle) {
    if RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    let spawned = std::thread::Builder::new()
        .name("refine-selection".into())
        .spawn(move || {
            let result = refine(&app);
            show_fix_result(&app, result);
            RUNNING.store(false, Ordering::SeqCst);
        });
    if let Err(e) = spawned {
        warn!("Could not start refine-selection: {e}");
        RUNNING.store(false, Ordering::SeqCst);
    }
}

fn refine(app: &AppHandle) -> FixResult {
    let Some(settings) = refine_settings(app) else {
        return FixResult::NoEngine;
    };
    wait_for_modifiers_released(Duration::from_millis(1500));
    std::thread::sleep(Duration::from_millis(40));

    let selected = match copy_selection(app) {
        Ok(Some(text)) => text,
        Ok(None) => return FixResult::NothingSelected,
        Err(e) => {
            warn!("Refine selection: could not copy the selection: {e}");
            return FixResult::Failed;
        }
    };

    show_refining_overlay(app);
    let refined =
        match tauri::async_runtime::block_on(post_process_transcription(&settings, &selected)) {
            PostProcessOutcome::Done(text) if !text.trim().is_empty() => text,
            _ => return FixResult::Failed,
        };
    // Keep the selection's surrounding whitespace, so text doesn't jump.
    let lead = &selected[..selected.len() - selected.trim_start().len()];
    let trail = &selected[selected.trim_end().len()..];
    let refined = format!("{lead}{}{trail}", refined.trim());
    if refined.trim() == selected.trim() {
        return FixResult::Clean;
    }
    let words = refined.split_whitespace().count();
    match replace_selection(app, &refined) {
        Ok(()) => FixResult::Refined(words),
        Err(e) => {
            warn!("Refine selection: could not replace the selection: {e}");
            FixResult::Failed
        }
    }
}

/// Settings tuned for Refine: the user's own AI if it's set up, otherwise free
/// Groq if they added a key, otherwise Apple Intelligence on supported Macs.
fn refine_settings(app: &AppHandle) -> Option<AppSettings> {
    let mut s = get_settings(app);
    let has_key = |s: &AppSettings, id: &str| {
        s.post_process_api_keys
            .get(id)
            .is_some_and(|k| !k.trim().is_empty())
    };
    let has_model = |s: &AppSettings, id: &str| {
        s.post_process_models
            .get(id)
            .is_some_and(|m| !m.trim().is_empty())
    };
    let active = s.post_process_provider_id.clone();
    let provider = if active != APPLE_INTELLIGENCE_PROVIDER_ID
        && has_key(&s, &active)
        && has_model(&s, &active)
    {
        active
    } else if has_key(&s, "groq") {
        if !has_model(&s, "groq") {
            s.post_process_models
                .insert("groq".into(), GROQ_DEFAULT_MODEL.into());
        }
        "groq".to_string()
    } else if apple_intelligence_ready() {
        APPLE_INTELLIGENCE_PROVIDER_ID.to_string()
    } else {
        return None;
    };
    s.post_process_provider_id = provider;
    s.post_process_selected_prompt_id = Some(VOBI_REFINE_PROMPT_ID.to_string());
    if !s
        .post_process_prompts
        .iter()
        .any(|p| p.id == VOBI_REFINE_PROMPT_ID)
    {
        s.post_process_prompts
            .push(crate::settings::vobi_refine_prompt());
    }
    Some(s)
}

fn apple_intelligence_ready() -> bool {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        crate::apple_intelligence::check_apple_intelligence_availability()
    }
    #[cfg(not(all(target_os = "macos", target_arch = "aarch64")))]
    {
        false
    }
}
