//! "Fix selection": select text in any app, press the shortcut, and Vobi
//! corrects the spelling in place, then says what it changed in the pill.

use crate::actions::{post_process_transcription, PostProcessOutcome};
use crate::clipboard::{copy_selection, replace_selection};
use crate::input::wait_for_modifiers_released;
use crate::overlay::{
    hide_recording_overlay, show_fix_result, show_refine_preview, show_refining_overlay, FixResult,
};
use crate::settings::{
    get_settings, AppSettings, APPLE_INTELLIGENCE_PROVIDER_ID, GROQ_DEFAULT_MODEL,
    VOBI_REFINE_PROMPT_ID,
};
use crate::spellfix;
use log::{info, warn};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::AppHandle;

/// One fix at a time: a second press while one is running is ignored.
static RUNNING: AtomicBool = AtomicBool::new(false);

/// The selected text, and (on macOS) the element it lives in, so it can be
/// replaced in place without the clipboard.
struct Grabbed {
    text: String,
    #[cfg(target_os = "macos")]
    focus: Option<crate::ax_text::FocusedText>,
}

/// Reads the current selection: directly through Accessibility where the app
/// allows it (macOS), otherwise by copying it.
fn grab(app: &AppHandle) -> Result<Option<Grabbed>, String> {
    #[cfg(target_os = "macos")]
    if let Some((focus, text)) = crate::ax_text::focused_selection() {
        if !text.trim().is_empty() {
            return Ok(Some(Grabbed {
                text,
                focus: Some(focus),
            }));
        }
    }
    Ok(copy_selection(app)?.map(|text| Grabbed {
        text,
        #[cfg(target_os = "macos")]
        focus: None,
    }))
}

/// Replaces the grabbed selection with `new`, in place where possible.
fn put(app: &AppHandle, grabbed: &Grabbed, new: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    if let Some(focus) = &grabbed.focus {
        if crate::ax_text::replace_selection(focus, &grabbed.text, new) {
            return Ok(());
        }
        info!("Selection isn't editable directly here; using the clipboard");
    }
    replace_selection(app, new)
}

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

    let grabbed = match grab(app) {
        Ok(Some(g)) => g,
        Ok(None) => return FixResult::NothingSelected,
        Err(e) => {
            warn!("Fix selection: could not read the selection: {e}");
            return FixResult::Failed;
        }
    };

    let custom_words = get_settings(app).custom_words;
    let result = spellfix::correct(&grabbed.text, &custom_words);
    if result.fixes.is_empty() {
        return FixResult::Clean;
    }
    info!("Fix selection: {} correction(s)", result.fixes.len());
    match put(app, &grabbed, &result.text) {
        Ok(()) => FixResult::Fixed(result.fixes),
        Err(e) => {
            warn!("Fix selection: could not replace the selection: {e}");
            FixResult::Failed
        }
    }
}

/// A refined text waiting for the user to approve it in the preview.
struct Pending {
    grabbed: Grabbed,
    refined: String,
    settings: AppSettings,
    /// The app the text came from, handed focus back after a click on the card.
    front: Option<i32>,
}

/// Clicking the preview card can make macOS bring Vobi (and its window) to
/// the front. These keep the app the person was writing in frontmost.
#[cfg(target_os = "macos")]
mod front_app {
    use objc2_app_kit::{NSApplicationActivationOptions, NSRunningApplication, NSWorkspace};

    pub fn current() -> Option<i32> {
        NSWorkspace::sharedWorkspace()
            .frontmostApplication()
            .map(|app| app.processIdentifier())
    }

    /// Re-activates `pid` if Vobi took the front in the meantime.
    #[allow(deprecated)]
    pub fn restore(pid: Option<i32>) {
        let Some(pid) = pid else { return };
        if current() != Some(std::process::id() as i32) {
            return;
        }
        if let Some(app) = NSRunningApplication::runningApplicationWithProcessIdentifier(pid) {
            app.activateWithOptions(NSApplicationActivationOptions::empty());
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod front_app {
    pub fn current() -> Option<i32> {
        None
    }
    pub fn restore(_pid: Option<i32>) {}
}

static PENDING: Mutex<Option<Pending>> = Mutex::new(None);

/// "Refine selection": rewrite the selected text with the AI and show it as a
/// preview; the user then pastes it, asks for another try, or closes it.
pub fn run_refine(app: &AppHandle) {
    if RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    let spawned = std::thread::Builder::new()
        .name("refine-selection".into())
        .spawn(move || {
            if let Some(result) = refine(&app) {
                show_fix_result(&app, result);
            }
            RUNNING.store(false, Ordering::SeqCst);
        });
    if let Err(e) = spawned {
        warn!("Could not start refine-selection: {e}");
        RUNNING.store(false, Ordering::SeqCst);
    }
}

/// Returns a result to show in the pill, or `None` when the preview is up.
fn refine(app: &AppHandle) -> Option<FixResult> {
    let Some(settings) = refine_settings(app) else {
        return Some(FixResult::NoEngine);
    };
    wait_for_modifiers_released(Duration::from_millis(1500));
    std::thread::sleep(Duration::from_millis(40));

    let grabbed = match grab(app) {
        Ok(Some(g)) => g,
        Ok(None) => return Some(FixResult::NothingSelected),
        Err(e) => {
            warn!("Refine selection: could not read the selection: {e}");
            return Some(FixResult::Failed);
        }
    };

    let front = front_app::current();
    show_refining_overlay(app);
    let Some(refined) = ask_ai(&settings, &grabbed.text) else {
        return Some(FixResult::Failed);
    };
    if refined.trim() == grabbed.text.trim() {
        return Some(FixResult::Clean);
    }
    show_refine_preview(app, &refined, false);
    *PENDING.lock().unwrap_or_else(|e| e.into_inner()) = Some(Pending {
        grabbed,
        refined,
        settings,
        front,
    });
    None
}

fn ask_ai(settings: &AppSettings, text: &str) -> Option<String> {
    match tauri::async_runtime::block_on(post_process_transcription(settings, text)) {
        PostProcessOutcome::Done(t) if !t.trim().is_empty() => Some(t.trim().to_string()),
        _ => None,
    }
}

/// Keeps the selection's surrounding whitespace, so text doesn't jump.
fn with_original_spacing(original: &str, refined: &str) -> String {
    let lead = &original[..original.len() - original.trim_start().len()];
    let trail = &original[original.trim_end().len()..];
    format!("{lead}{}{trail}", refined.trim())
}

/// Preview "Paste": put the refined text in place of the selection.
#[tauri::command]
#[specta::specta]
pub fn refine_accept(app: AppHandle) {
    let Some(pending) = PENDING.lock().unwrap_or_else(|e| e.into_inner()).take() else {
        hide_recording_overlay(&app);
        return;
    };
    std::thread::spawn(move || {
        // Back to the app the text lives in before writing into it.
        front_app::restore(pending.front);
        std::thread::sleep(Duration::from_millis(60));
        let text = with_original_spacing(&pending.grabbed.text, &pending.refined);
        let words = text.split_whitespace().count();
        let result = match put(&app, &pending.grabbed, &text) {
            Ok(()) => FixResult::Refined(words),
            Err(e) => {
                warn!("Refine selection: could not replace the selection: {e}");
                FixResult::Failed
            }
        };
        show_fix_result(&app, result);
    });
}

/// Preview "Refine again": ask for a better, different version.
#[tauri::command]
#[specta::specta]
pub fn refine_again(app: AppHandle) {
    let (original, previous, mut settings, front) = {
        let guard = PENDING.lock().unwrap_or_else(|e| e.into_inner());
        let Some(p) = guard.as_ref() else {
            return;
        };
        (
            p.grabbed.text.clone(),
            p.refined.clone(),
            p.settings.clone(),
            p.front,
        )
    };
    front_app::restore(front);
    show_refine_preview(&app, &previous, true);
    if let Some(prompt) = settings
        .post_process_prompts
        .iter_mut()
        .find(|p| p.id == VOBI_REFINE_PROMPT_ID)
    {
        prompt.prompt.push_str(&format!(
            "\n\nA previous rewrite was:\n<previous>\n{previous}\n</previous>\nThe person wants a better version: clearer, more natural and more concise, and noticeably different from the previous one. Do not repeat it."
        ));
    }
    std::thread::spawn(move || {
        let refined = ask_ai(&settings, &original);
        let mut guard = PENDING.lock().unwrap_or_else(|e| e.into_inner());
        let Some(p) = guard.as_mut() else {
            return; // closed meanwhile
        };
        if let Some(text) = refined {
            p.refined = text;
        }
        show_refine_preview(&app, &p.refined, false);
    });
}

/// Preview "✕": keep the original text.
#[tauri::command]
#[specta::specta]
pub fn refine_dismiss(app: AppHandle) {
    if let Some(p) = PENDING.lock().unwrap_or_else(|e| e.into_inner()).take() {
        front_app::restore(p.front);
    }
    hide_recording_overlay(&app);
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
