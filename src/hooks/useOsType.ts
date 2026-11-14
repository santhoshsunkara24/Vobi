import { type } from "@tauri-apps/plugin-os";
import { type OSType } from "../lib/utils/keyboard";

/**
 * The OS, for keyboard handling and platform differences. `type()` is
 * synchronous, but throws outside Tauri (a plain browser), so this falls
 * back to "unknown" there.
 */
export function currentOsType(): OSType {
  try {
    // type() returns "macos" | "windows" | "linux" | "ios" | "android"
    const osType = type();
    if (osType === "macos" || osType === "windows" || osType === "linux") {
      return osType;
    }
  } catch {
    // Not running in Tauri.
  }
  return "unknown";
}

/** Get the current OS type for keyboard handling. */
export function useOsType(): OSType {
  return currentOsType();
}
