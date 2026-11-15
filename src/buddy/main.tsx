import React from "react";
import ReactDOM from "react-dom/client";
import Buddy from "./Buddy";

// Vobi on screen floats over other apps: a right-click opens Vobi's own menu
// (buddy.rs), never the webview's (Reload, Inspect, ...).
window.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Buddy />
  </React.StrictMode>,
);
