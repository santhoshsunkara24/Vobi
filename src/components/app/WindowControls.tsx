import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Windows: Vobi draws its own title bar so the page runs edge to edge like on
 * macOS. These are the minimise / maximise / close buttons, sized and coloured
 * like Windows 11's own caption buttons (46 x 32, red close on hover).
 */
export const WindowControls: React.FC = () => {
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    const sync = () =>
      win
        .isMaximized()
        .then(setMaximized)
        .catch(() => {});
    sync();
    win
      .onResized(sync)
      .then((u) => (unlisten = u))
      .catch(() => {});
    return () => unlisten?.();
  }, []);

  const win = () => getCurrentWindow();

  return (
    <div className="v-caption" role="group">
      <button
        type="button"
        className="v-caption-btn"
        aria-label={t("windowControls.minimize")}
        title={t("windowControls.minimize")}
        onClick={() => win().minimize()}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 5h10" />
        </svg>
      </button>
      <button
        type="button"
        className="v-caption-btn"
        aria-label={
          maximized ? t("windowControls.restore") : t("windowControls.maximize")
        }
        title={
          maximized ? t("windowControls.restore") : t("windowControls.maximize")
        }
        onClick={() => win().toggleMaximize()}
      >
        {maximized ? (
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" />
            <rect x="0.5" y="2.5" width="7" height="7" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <rect x="0.5" y="0.5" width="9" height="9" rx="1.2" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="v-caption-btn v-caption-close"
        aria-label={t("windowControls.close")}
        title={t("windowControls.close")}
        onClick={() => win().close()}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
        </svg>
      </button>
    </div>
  );
};
