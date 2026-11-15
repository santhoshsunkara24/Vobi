//! Read and replace the selected text of the focused app directly, through the
//! macOS Accessibility API. This edits exactly the selection in place, with no
//! clipboard and no keystrokes, in apps that support it (Notes, Mail, TextEdit,
//! Messages, Pages, most native and web text fields). Callers fall back to the
//! clipboard when it isn't available.
//!
//! Vobi already needs the Accessibility permission to paste, so this asks for
//! nothing new.

use std::ffi::c_void;

use objc2::rc::Retained;
use objc2_foundation::NSString;

type CFTypeRef = *const c_void;
type AXUIElementRef = *const c_void;
type AXError = i32;
const AX_SUCCESS: AXError = 0;

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXUIElementCreateSystemWide() -> AXUIElementRef;
    fn AXUIElementCopyAttributeValue(
        element: AXUIElementRef,
        attribute: CFTypeRef,
        value: *mut CFTypeRef,
    ) -> AXError;
    fn AXUIElementSetAttributeValue(
        element: AXUIElementRef,
        attribute: CFTypeRef,
        value: CFTypeRef,
    ) -> AXError;
    fn AXUIElementIsAttributeSettable(
        element: AXUIElementRef,
        attribute: CFTypeRef,
        settable: *mut u8,
    ) -> AXError;
    fn AXValueCreate(the_type: u32, value: *const c_void) -> CFTypeRef;
    fn AXValueGetValue(value: CFTypeRef, the_type: u32, out: *mut c_void) -> u8;
}

/// `kAXValueCFRangeType`: an AXValue wrapping a CFRange.
const AX_VALUE_CF_RANGE: u32 = 4;

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct CFRange {
    location: isize,
    length: isize,
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFRelease(cf: CFTypeRef);
    fn CFGetTypeID(cf: CFTypeRef) -> usize;
    fn CFStringGetTypeID() -> usize;
}

/// The focused text element of the frontmost app, kept so its selection can be
/// replaced later (e.g. after the user approves a Refine preview).
pub struct FocusedText(AXUIElementRef);

// SAFETY: AXUIElementRef is an immutable CF object; the AX API may be called
// from any thread.
unsafe impl Send for FocusedText {}

impl Drop for FocusedText {
    fn drop(&mut self) {
        // SAFETY: we own one retain on the element (from Copy...).
        unsafe { CFRelease(self.0) }
    }
}

fn attr(name: &str) -> Retained<NSString> {
    NSString::from_str(name)
}

fn copy_string(element: AXUIElementRef, name: &str) -> Option<String> {
    let a = attr(name);
    let mut value: CFTypeRef = std::ptr::null();
    // SAFETY: valid element and attribute; on success we own `value`.
    let err = unsafe {
        AXUIElementCopyAttributeValue(element, Retained::as_ptr(&a) as CFTypeRef, &mut value)
    };
    if err != AX_SUCCESS || value.is_null() {
        return None;
    }
    // SAFETY: value is a live CF object we own.
    let text = unsafe {
        if CFGetTypeID(value) == CFStringGetTypeID() {
            // CFString is toll-free bridged with NSString.
            Some((*(value as *const NSString)).to_string())
        } else {
            None
        }
    };
    // SAFETY: balance the Copy above.
    unsafe { CFRelease(value) };
    text
}

/// The focused element and its current selection, if the app exposes them.
pub fn focused_selection() -> Option<(FocusedText, String)> {
    // SAFETY: system-wide element; released at the end of this function.
    let system = unsafe { AXUIElementCreateSystemWide() };
    if system.is_null() {
        return None;
    }
    let a = attr("AXFocusedUIElement");
    let mut focused: CFTypeRef = std::ptr::null();
    // SAFETY: valid element and attribute; on success we own `focused`.
    let err = unsafe {
        AXUIElementCopyAttributeValue(system, Retained::as_ptr(&a) as CFTypeRef, &mut focused)
    };
    // SAFETY: balance AXUIElementCreateSystemWide.
    unsafe { CFRelease(system) };
    if err != AX_SUCCESS || focused.is_null() {
        return None;
    }
    let element = FocusedText(focused);
    let selected = copy_string(element.0, "AXSelectedText")?;
    Some((element, selected))
}

/// Replaces the element's selection with `text`. Returns false when the app
/// doesn't allow it (the caller then falls back to the clipboard).
pub fn replace_selection(element: &FocusedText, previous: &str, text: &str) -> bool {
    let a = attr("AXSelectedText");
    let key = Retained::as_ptr(&a) as CFTypeRef;
    let mut settable: u8 = 0;
    // SAFETY: valid element and attribute, output is a local.
    let err = unsafe { AXUIElementIsAttributeSettable(element.0, key, &mut settable) };
    if err != AX_SUCCESS || settable == 0 {
        return false;
    }
    let value = NSString::from_str(text);
    // SAFETY: valid element, attribute and CFString value.
    let err = unsafe {
        AXUIElementSetAttributeValue(element.0, key, Retained::as_ptr(&value) as CFTypeRef)
    };
    if err != AX_SUCCESS {
        return false;
    }
    // Some apps report success but ignore the write: if the old selection is
    // still there untouched, treat it as a failure.
    !matches!(
        copy_string(element.0, "AXSelectedText"),
        Some(now) if now == previous && previous != text
    )
}

/// Where the selection starts, in UTF-16 units, if the app reports it.
pub fn selection_start(element: &FocusedText) -> Option<isize> {
    let a = attr("AXSelectedTextRange");
    let mut value: CFTypeRef = std::ptr::null();
    // SAFETY: valid element and attribute; on success we own `value`.
    let err = unsafe {
        AXUIElementCopyAttributeValue(element.0, Retained::as_ptr(&a) as CFTypeRef, &mut value)
    };
    if err != AX_SUCCESS || value.is_null() {
        return None;
    }
    let mut range = CFRange::default();
    // SAFETY: `value` is an AXValue we own; `range` is a matching CFRange.
    let ok = unsafe {
        AXValueGetValue(
            value,
            AX_VALUE_CF_RANGE,
            &mut range as *mut CFRange as *mut c_void,
        )
    };
    // SAFETY: balance the Copy above.
    unsafe { CFRelease(value) };
    (ok != 0).then_some(range.location)
}

/// Selects `length` UTF-16 units from `location`. Returns whether the app
/// took it (used to select the text Fix just wrote, for "Refine instead").
pub fn select_range(element: &FocusedText, location: isize, length: isize) -> bool {
    let a = attr("AXSelectedTextRange");
    let range = CFRange { location, length };
    // SAFETY: AXValueCreate copies the CFRange; we release the result.
    let value =
        unsafe { AXValueCreate(AX_VALUE_CF_RANGE, &range as *const CFRange as *const c_void) };
    if value.is_null() {
        return false;
    }
    // SAFETY: valid element, attribute and AXValue.
    let err = unsafe {
        AXUIElementSetAttributeValue(element.0, Retained::as_ptr(&a) as CFTypeRef, value)
    };
    // SAFETY: balance AXValueCreate.
    unsafe { CFRelease(value) };
    err == AX_SUCCESS
}
