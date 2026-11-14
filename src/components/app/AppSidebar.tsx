import React from "react";
import { useTranslation } from "react-i18next";
import { VobiCloud } from "@/components/vobi/VobiCloud";
import ModelSelector from "@/components/model-selector";
import UpdateChecker from "@/components/update-checker";
import NoticeChip from "@/components/footer/NoticeChip";
import TranscriptionStatus from "@/components/footer/TranscriptionStatus";
import { HotkeyKbd } from "./Hotkey";
import {
  DictionaryIcon,
  HistoryIcon,
  HomeIcon,
  SettingsIcon,
  SnippetsIcon,
} from "./icons";
import { useSlidingThumb } from "./useSlidingThumb";

export type Page = "home" | "history" | "dictionary" | "snippets" | "settings";

const NAV: { id: Page; icon: React.FC }[] = [
  { id: "home", icon: HomeIcon },
  { id: "history", icon: HistoryIcon },
  { id: "dictionary", icon: DictionaryIcon },
  { id: "snippets", icon: SnippetsIcon },
  { id: "settings", icon: SettingsIcon },
];

interface AppSidebarProps {
  page: Page;
  onNavigate: (page: Page) => void;
}

/** Brand, the five pages with a sliding highlight, and the status card. */
export const AppSidebar: React.FC<AppSidebarProps> = ({ page, onNavigate }) => {
  const { t } = useTranslation();
  const { ref, style } = useSlidingThumb<HTMLElement>(page, "y");

  return (
    <aside className="v-side">
      <div className="v-brand">
        <VobiCloud size={30} />
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <span>Vobi</span>
      </div>
      <nav ref={ref} className="v-nav" aria-label={t("vobi.nav.label")}>
        <span className="v-hl" style={style} aria-hidden="true" />
        {NAV.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={page === id ? "page" : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon />
            {t(`vobi.nav.${id}`)}
          </button>
        ))}
      </nav>

      <div className="v-side-card">
        <div className="v-row">
          <span className="v-live" aria-hidden="true" />
          {t("vobi.side.ready")}
        </div>
        <p>
          {t("vobi.side.holdBefore")} <HotkeyKbd /> {t("vobi.side.holdAfter")}
        </p>
        <div className="mt-[12px] flex flex-col gap-[6px] border-t border-[var(--border)] pt-[10px] text-[12.5px] font-medium text-ink-3">
          <ModelSelector />
          <TranscriptionStatus onShowHistory={() => onNavigate("history")} />
          <NoticeChip />
          <UpdateChecker quiet />
        </div>
      </div>
    </aside>
  );
};
