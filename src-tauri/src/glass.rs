//! "Liquid glass" behind the recording pill.
//!
//! A web page can't blur the apps behind its window, so on macOS a native
//! glass view is placed under the overlay's webview and kept exactly under the
//! pill (position, size, corner radius and fade), driven by the overlay page as
//! the pill animates. On macOS 26+ that's Apple's own Liquid Glass
//! (NSGlassEffectView), so the pill matches system glass exactly; older macOS
//! falls back to an NSVisualEffectView blur. On Windows 11 (22H2+) the overlay
//! window gets DWM's Acrylic backdrop, clipped to the pill by a window region.
//! Elsewhere (Windows 10, Linux) the page draws a frosted fallback itself and
//! this reports `false`.

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
    #[cfg(target_os = "windows")]
    {
        win::set(&app, x, y, width, height, radius, alpha, visible)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (app, x, y, width, height, radius, alpha, visible);
        false
    }
}

/// Windows 11: DWM's Acrylic system backdrop on the overlay window.
///
/// The overlay window is bigger than the pill, and a DWM backdrop covers the
/// whole window, so the window is clipped to the pill's rounded rectangle with
/// `SetWindowRgn` (which also lets clicks outside the pill fall through). The
/// backdrop is only switched on while the pill is showing, and the region is
/// set first, so the full window never flashes as glass.
#[cfg(target_os = "windows")]
mod win {
    use std::cell::RefCell;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::OnceLock;
    use tauri::{AppHandle, Manager};
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMSBT_NONE, DWMSBT_TRANSIENTWINDOW, DWMWA_SYSTEMBACKDROP_TYPE,
        DWMWA_USE_IMMERSIVE_DARK_MODE, DWM_SYSTEMBACKDROP_TYPE,
    };
    use windows::Win32::Graphics::Gdi::{CreateRoundRectRgn, DeleteObject, SetWindowRgn};

    /// `DWMWA_SYSTEMBACKDROP_TYPE` is documented from Windows 11 22H2.
    const MIN_BUILD: u32 = 22621;

    /// DWM can't fade a backdrop, so it appears once the pill is this far into
    /// its fade-in (and goes once it's this far out).
    const FADE_THRESHOLD: f64 = 0.35;

    /// Set when DWM refused the backdrop, so the page goes back to painting
    /// its own fallback instead of a see-through pill with nothing behind it.
    static FAILED: AtomicBool = AtomicBool::new(false);

    #[derive(Default)]
    struct State {
        on: bool,
        /// CSS px to physical px, captured when the glass appears.
        scale: f64,
        /// The last region set, in physical px: left, top, right, bottom, diameter.
        region: Option<(i32, i32, i32, i32, i32)>,
    }

    thread_local! {
        // Main-thread only, alongside the window's message loop.
        static STATE: RefCell<State> = RefCell::new(State::default());
    }

    fn os_supported() -> bool {
        static SUPPORTED: OnceLock<bool> = OnceLock::new();
        *SUPPORTED.get_or_init(|| {
            winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE)
                .open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
                .and_then(|key| key.get_value::<String, _>("CurrentBuildNumber"))
                .ok()
                .and_then(|build| build.trim().parse::<u32>().ok())
                .is_some_and(|build| build >= MIN_BUILD)
        })
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
    ) -> bool {
        if !os_supported() || FAILED.load(Ordering::Relaxed) {
            return false;
        }
        let Some(window) = app.get_webview_window("recording_overlay") else {
            return false;
        };
        let _ = app.run_on_main_thread(move || {
            let Ok(hwnd) = window.hwnd() else {
                return;
            };
            STATE.with(|cell| {
                let mut st = cell.borrow_mut();
                let show = visible && width >= 1.0 && height >= 1.0 && alpha > FADE_THRESHOLD;
                if !show {
                    if st.on {
                        set_backdrop(hwnd, false);
                        // SAFETY: a live HWND owned by this thread; None removes the region.
                        unsafe {
                            SetWindowRgn(hwnd, None, true);
                        }
                        st.on = false;
                        st.region = None;
                    }
                    return;
                }

                if !st.on {
                    // WebView2 applies the accessibility text size as a zoom on
                    // top of display scaling, like the window sizing does.
                    st.scale = window.scale_factor().unwrap_or(1.0)
                        * crate::overlay::windows_text_scale_factor();
                }
                let s = st.scale;
                let r = radius.min(height / 2.0).min(width / 2.0).max(0.0);
                let region = (
                    (x * s).round() as i32,
                    (y * s).round() as i32,
                    ((x + width) * s).round() as i32,
                    ((y + height) * s).round() as i32,
                    (r * 2.0 * s).round() as i32,
                );
                if st.region != Some(region) {
                    let (left, top, right, bottom, d) = region;
                    // SAFETY: plain GDI calls on a live HWND owned by this
                    // thread. On success the system owns the region; on
                    // failure we free it. CreateRoundRectRgn's right/bottom
                    // edges are exclusive, hence the +1.
                    unsafe {
                        let rgn = CreateRoundRectRgn(left, top, right + 1, bottom + 1, d, d);
                        if !rgn.is_invalid() && SetWindowRgn(hwnd, Some(rgn), true) == 0 {
                            let _ = DeleteObject(rgn.into());
                        }
                    }
                    st.region = Some(region);
                }

                if !st.on {
                    if set_backdrop(hwnd, true) {
                        st.on = true;
                    } else {
                        FAILED.store(true, Ordering::Relaxed);
                        // SAFETY: as above.
                        unsafe {
                            SetWindowRgn(hwnd, None, true);
                        }
                        st.region = None;
                    }
                }
            });
        });
        true
    }

    /// Turns the Acrylic ("transient window") backdrop on or off, in its dark
    /// variant to sit under the pill's white text. Returns whether DWM took it.
    fn set_backdrop(hwnd: HWND, on: bool) -> bool {
        let dark: i32 = 1;
        let kind: DWM_SYSTEMBACKDROP_TYPE = if on {
            DWMSBT_TRANSIENTWINDOW
        } else {
            DWMSBT_NONE
        };
        // SAFETY: documented DWM attributes, each given a pointer to a value
        // of the right type and size that outlives the call.
        unsafe {
            if on {
                let _ = DwmSetWindowAttribute(
                    hwnd,
                    DWMWA_USE_IMMERSIVE_DARK_MODE,
                    &dark as *const i32 as *const _,
                    std::mem::size_of::<i32>() as u32,
                );
            }
            DwmSetWindowAttribute(
                hwnd,
                DWMWA_SYSTEMBACKDROP_TYPE,
                &kind as *const DWM_SYSTEMBACKDROP_TYPE as *const _,
                std::mem::size_of::<DWM_SYSTEMBACKDROP_TYPE>() as u32,
            )
            .is_ok()
        }
    }
}

#[cfg(target_os = "macos")]
mod mac {
    use objc2::rc::Retained;
    use objc2::runtime::{AnyClass, AnyObject};
    use objc2::{msg_send, MainThreadMarker};
    use objc2_app_kit::{
        NSAppearance, NSAppearanceCustomization, NSAppearanceNameDarkAqua, NSColor,
        NSGlassEffectView, NSGlassEffectViewStyle, NSView, NSVisualEffectBlendingMode,
        NSVisualEffectMaterial, NSVisualEffectState, NSVisualEffectView, NSWindow,
        NSWindowOrderingMode,
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
        // Smoky dark glass in every system appearance, under white text.
        // SAFETY: NSAppearanceNameDarkAqua is a framework-provided constant.
        if let Some(dark) = NSAppearance::appearanceNamed(unsafe { NSAppearanceNameDarkAqua }) {
            view.setAppearance(Some(&dark));
        }
        view.setHidden(true);
        // Underneath the webview, so the pill's content draws on top.
        content.addSubview_positioned_relativeTo(view, NSWindowOrderingMode::Below, None);
        glass
    }

    /// A trace of dark smoke over the clear glass, just enough to keep the
    /// pill's white text readable over bright pages.
    const SMOKE: f64 = 0.2;

    /// Apple's Liquid Glass (macOS 26+) in its clear style, the same see-through
    /// glass as the Dock: the system draws the blur, refraction, bright rim and
    /// shadow.
    fn make_liquid(mtm: MainThreadMarker) -> Retained<NSGlassEffectView> {
        let view = NSGlassEffectView::initWithFrame(
            mtm.alloc(),
            NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(1.0, 1.0)),
        );
        view.setStyle(NSGlassEffectViewStyle::Clear);
        let smoke = NSColor::colorWithSRGBRed_green_blue_alpha(0.11, 0.115, 0.125, SMOKE);
        view.setTintColor(Some(&smoke));
        view
    }

    /// Older macOS: a behind-window blur, clipped to the pill by its layer.
    fn make_blur(mtm: MainThreadMarker) -> Retained<NSVisualEffectView> {
        let view = NSVisualEffectView::initWithFrame(
            mtm.alloc(),
            NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(1.0, 1.0)),
        );
        view.setMaterial(NSVisualEffectMaterial::HUDWindow);
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
