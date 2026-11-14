import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FileDropOverlay } from "@/components/FileDropOverlay";
import { WhatsNewGate } from "@/components/whats-new";
import type { OnboardingStep } from "@/components/onboarding/onboardingStore";
import { AppRail } from "./AppRail";
import { NavContext, type Navigate, type Page } from "./nav";
import { HomePage } from "./pages/HomePage";
import { HistoryPage } from "./pages/HistoryPage";
import { DictionaryPage } from "./pages/DictionaryPage";
import { SnippetsPage } from "./pages/SnippetsPage";
import { SettingsPage, type SettingsTab } from "./pages/SettingsPage";

interface AppShellProps {
  direction: "ltr" | "rtl";
  onPreviewOnboarding: (step: OnboardingStep) => void;
  onRunOnboarding: () => void;
  onRunModelMigration: () => void;
}

/** The main window: the icon rail and one rounded panel holding the page. */
export const AppShell: React.FC<AppShellProps> = ({
  direction,
  onPreviewOnboarding,
  onRunOnboarding,
  onRunModelMigration,
}) => {
  const [page, setPage] = useState<Page>("home");
  const [tab, setTab] = useState<SettingsTab>("general");
  // Bumped on each "add" request so a page can focus its field.
  const [focus, setFocus] = useState<{ page: Page; n: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const navigate = useCallback<Navigate>((to, want) => {
    setPage(to);
    if (want === "model") setTab("model");
    setFocus(want === "add" ? { page: to, n: Date.now() } : null);
  }, []);
  const showHistory = useCallback(() => navigate("history"), [navigate]);

  useLayoutEffect(() => {
    panelRef.current?.querySelector("[data-page-scroll]")?.scrollTo({ top: 0 });
  }, [page, tab]);

  const wantsFocus = focus?.page === page;

  return (
    <NavContext.Provider value={navigate}>
      <div dir={direction} className="v-app select-none cursor-default">
        {/* macOS: the title bar is transparent; this strip drags the window. */}
        <div className="v-drag" data-tauri-drag-region aria-hidden="true" />
        <ErrorBoundary context="What's New">
          <WhatsNewGate />
        </ErrorBoundary>
        <AppRail page={page} onNavigate={(p) => navigate(p)} />
        <main ref={panelRef} className="v-panel">
          {page === "home" && <HomePage />}
          {page === "history" && <HistoryPage />}
          {page === "dictionary" && (
            <DictionaryPage key={focus?.n} autoFocus={wantsFocus} />
          )}
          {page === "snippets" && (
            <SnippetsPage key={focus?.n} autoFocus={wantsFocus} />
          )}
          {page === "settings" && (
            <SettingsPage
              tab={tab}
              onTab={setTab}
              onNavigate={(p) => navigate(p)}
              onPreviewOnboarding={onPreviewOnboarding}
              onRunOnboarding={onRunOnboarding}
              onRunModelMigration={onRunModelMigration}
            />
          )}
        </main>
        <FileDropOverlay onDropped={showHistory} />
      </div>
    </NavContext.Provider>
  );
};
