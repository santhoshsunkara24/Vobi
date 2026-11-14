import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FileDropOverlay } from "@/components/FileDropOverlay";
import { WhatsNewGate } from "@/components/whats-new";
import type { OnboardingStep } from "@/components/onboarding/onboardingStore";
import { AppSidebar, type Page } from "./AppSidebar";
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

/** The main window: sidebar and the five pages. */
export const AppShell: React.FC<AppShellProps> = ({
  direction,
  onPreviewOnboarding,
  onRunOnboarding,
  onRunModelMigration,
}) => {
  const [page, setPage] = useState<Page>("home");
  const [tab, setTab] = useState<SettingsTab>("general");
  // Bumped on each navigation so a page can focus its field when asked to.
  const [focus, setFocus] = useState<{ page: Page; n: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback((to: Page, want?: "add") => {
    setPage(to);
    setFocus(want ? { page: to, n: Date.now() } : null);
  }, []);
  const showHistory = useCallback(() => navigate("history"), [navigate]);

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page, tab]);

  const wantsFocus = focus?.page === page;

  return (
    <div dir={direction} className="v-app select-none cursor-default">
      {/* macOS: the title bar is transparent; this strip drags the window. */}
      <div className="v-drag" data-tauri-drag-region aria-hidden="true" />
      <ErrorBoundary context="What's New">
        <WhatsNewGate />
      </ErrorBoundary>
      <AppSidebar page={page} onNavigate={navigate} />
      <main className="v-main">
        <div ref={scrollRef} className="v-scroll">
          {page === "home" && <HomePage onNavigate={navigate} />}
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
              onNavigate={navigate}
              onPreviewOnboarding={onPreviewOnboarding}
              onRunOnboarding={onRunOnboarding}
              onRunModelMigration={onRunModelMigration}
            />
          )}
        </div>
      </main>
      <FileDropOverlay onDropped={showHistory} />
    </div>
  );
};
