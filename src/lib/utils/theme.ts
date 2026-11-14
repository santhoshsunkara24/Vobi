import type { Theme } from "@/bindings";

/**
 * Vobi is light only. The persisted `theme` setting is ignored; these helpers
 * stay because the recording overlay's entry point still calls them, and they
 * now just pin the document to the light palette.
 */

/** Pin the document to the light palette, whatever theme is passed. */
export const applyTheme = (_theme?: Theme): void => {
  document.documentElement.dataset.theme = "light";
};

/** Always light. */
export const getStoredTheme = (): Theme => "light";

/** Nothing to reconcile: there is only one theme. */
export const syncThemeFromSettings = async (): Promise<void> => {
  applyTheme();
};
