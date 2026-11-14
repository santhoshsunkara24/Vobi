// The main window's entry. In a plain browser (`bun run dev` opened outside
// Tauri) a dev-only mock stands in for the backend so the UI can be reviewed;
// production builds drop that branch entirely.
const ready =
  import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)
    ? import("./dev/browserMock")
    : Promise.resolve();

ready.then(() => import("./boot"));
