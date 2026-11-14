//! "Liquid glass" behind the recording pill.
//!
//! A web page can't blur the apps behind its window, so on macOS a native
//! glass view is placed under the overlay's webview and kept exactly under the
//! pill (position, size, corner radius and fade), driven by the overlay page as
//! the pill animates. On macOS 26+ that's Apple's own Liquid Glass
//! (NSGlassEffectView), so the pill matches system glass exactly; older macOS
//! falls back to an NSVisualEffectView blur. Elsewhere the page draws a frosted
//! fallback itself and this reports `false`.

use tauri::AppHandle;

/// Places (or hides) the native glass under the pill. Coordinates are CSS
/// pixels in the overlay window, top-left origin. Returns whether native glass
/// is available on this platform.
#[tauri::command]
#[specta::specta]
#[allow(clippy::too_many_arguments)]
pub fn set_overlay_glass(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    radius: f64,
    alpha: f64,
    visible: bool,
) -> bool {
    #[cfg(target_os = "macos")]
    {
        mac::set(&app, x, y, width, height, radius, alpha, visible);
        true
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, x, y, width, height, radius, alpha, visible);
        false
    }
}

#[cfg(target_os = "macos")]
mod mac {
    use objc2::rc::Retained;
    use objc2::runtime::{AnyClass, AnyObject};
    use objc2::{msg_send, MainThreadMarker};
    use objc2_app_kit::{
        NSAppearance, NSAppearanceCustomization, NSAppearanceNameAqua, NSGlassEffectView,
        NSGlassEffectViewStyle, NSView, NSVisualEffectBlendingMode, NSVisualEffectMaterial,
        NSVisualEffectState, NSVisualEffectView, NSWindow, NSWindowOrderingMode,
    };
    use objc2_foundation::{NSPoint, NSRect, NSSize};
    use std::cell::RefCell;
    use tauri::{AppHandle, Manager};

    /// The native view under the pill: system Liquid Glass when the OS has
    /// it, otherwise a behind-window blur.
    enum Glass {
        Liquid(Retained<NSGlassEffectView>),
        Blur(Retained<NSVisualEffectView>),
    }

    impl Glass {
        fn view(&self) -> &NSView {
            match self {
                Glass::Liquid(v) => v,
                Glass::Blur(v) => v,
            }
        }

        fn set_corner_radius(&self, r: f64) {
            match self {
                // Liquid Glass shapes its own edge highlight to this radius.
                Glass::Liquid(v) => v.setCornerRadius(r),
                Glass::Blur(v) => {
                    // SAFETY: the view is layer-backed (set in make_blur), so
                    // `layer` is a live CALayer; a plain property setter.
                    unsafe {
                        let layer: *mut AnyObject = msg_send![&**v, layer];
                        if !layer.is_null() {
                            let _: () = msg_send![layer, setCornerRadius: r];
                        }
                    }
                }
            }
        }
    }

    thread_local! {
        // Main-thread only, like every AppKit view.
        static GLASS: RefCell<Option<Glass>> = const { RefCell::new(None) };
    }

    #[allow(clippy::too_many_arguments)]
    pub fn set(
        app: &AppHandle,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        radius: f64,
        alpha: f64,
        visible: bool,
    ) {
        let Some(window) = app.get_webview_window("recording_overlay") else {
            return;
        };
        let _ = app.run_on_main_thread(move || {
            let Some(mtm) = MainThreadMarker::new() else {
                return;
            };
            let Ok(ns_window) = window.ns_window() else {
                return;
            };
            // SAFETY: Tauri hands out the live NSWindow of this webview window;
            // we only use it on the main thread for the duration of this call.
            let ns_window: &NSWindow = unsafe { &*(ns_window as *const NSWindow) };
            let Some(content) = ns_window.contentView() else {
                return;
            };

            GLASS.with(|cell| {
                let mut slot = cell.borrow_mut();
                let glass = slot.get_or_insert_with(|| make_glass(mtm, &content));
                let view = glass.view();
                if !visible || width < 1.0 || height < 1.0 || alpha <= 0.01 {
                    view.setHidden(true);
                    return;
                }
                let content_h = content.frame().size.height;
                let frame = NSRect::new(
                    NSPoint::new(x, content_h - y - height),
                    NSSize::new(width, height),
                );
                view.setFrame(frame);
                view.setAlphaValue(alpha.clamp(0.0, 1.0));
                let r = radius.min(height / 2.0).min(width / 2.0).max(0.0);
                glass.set_corner_radius(r);
                view.setHidden(false);
            });
        });
    }

    fn make_glass(mtm: MainThreadMarker, content: &NSView) -> Glass {
        let glass = if AnyClass::get(c"NSGlassEffectView").is_some() {
            Glass::Liquid(make_liquid(mtm))
        } else {
            Glass::Blur(make_blur(mtm))
        };
        let view = glass.view();
        // Light glass in every system appearance (Vobi is light-theme only, and
        // the pill's text is dark).
        // SAFETY: NSAppearanceNameAqua is a framework-provided constant.
        if let Some(aqua) = NSAppearance::appearanceNamed(unsafe { NSAppearanceNameAqua }) {
            view.setAppearance(Some(&aqua));
        }
        view.setHidden(true);
        // Underneath the webview, so the pill's content draws on top.
        content.addSubview_positioned_relativeTo(view, NSWindowOrderingMode::Below, None);
        glass
    }

    /// Apple's Liquid Glass (macOS 26+): the frosted "regular" style, which
    /// draws its own refraction, edge highlight and shadow.
    fn make_liquid(mtm: MainThreadMarker) -> Retained<NSGlassEffectView> {
        let view = NSGlassEffectView::initWithFrame(
            mtm.alloc(),
            NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(1.0, 1.0)),
        );
        view.setStyle(NSGlassEffectViewStyle::Regular);
        view
    }

    /// Older macOS: a behind-window blur, clipped to the pill by its layer.
    fn make_blur(mtm: MainThreadMarker) -> Retained<NSVisualEffectView> {
        let view = NSVisualEffectView::initWithFrame(
            mtm.alloc(),
            NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(1.0, 1.0)),
        );
        view.setMaterial(NSVisualEffectMaterial::Popover);
        view.setBlendingMode(NSVisualEffectBlendingMode::BehindWindow);
        // Vobi's overlay is never the key window, so keep the glass active.
        view.setState(NSVisualEffectState::Active);
        view.setWantsLayer(true);
        // SAFETY: just made layer-backed; plain CALayer property setters.
        unsafe {
            let layer: *mut AnyObject = msg_send![&*view, layer];
            if !layer.is_null() {
                let _: () = msg_send![layer, setMasksToBounds: true];
            }
        }
        view
    }
}
