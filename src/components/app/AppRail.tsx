import React from "react";
import { useTranslation } from "react-i18next";
import {
  Book,
  History,
  Home,
  Settings,
  Zap,
  type BiconIcon,
} from "@hexline/bicon/react";
import { VobiCloud } from "@/components/vobi/VobiCloud";
import { useSlidingThumb } from "./useSlidingThumb";
import type { Page } from "./nav";

const NAV: { id: Page; icon: BiconIcon }[] = [
  { id: "home", icon: Home },
  { id: "history", icon: History },
  { id: "dictionary", icon: Book },
  { id: "snippets", icon: Zap },
  { id: "settings", icon: Settings },
];

interface AppRailProps {
  page: Page;
  onNavigate: (page: Page) => void;
}

/** The icon-only rail: Vobi on top, the pages below on a sliding white tile. */
export const AppRail: React.FC<AppRailProps> = ({ page, onNavigate }) => {
  const { t } = useTranslation();
  const { ref, style } = useSlidingThumb<HTMLElement>(page, "y");

  return (
    <aside className="v-rail">
      <div className="v-rail-brand" title="Vobi">
        <VobiCloud size={34} />
      </div>
      <nav ref={ref} className="v-rail-nav" aria-label={t("vobi.nav.label")}>
        <span className="v-hl" style={style} aria-hidden="true" />
        {NAV.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className="v-rail-btn"
            aria-current={page === id ? "page" : undefined}
            aria-label={t(`vobi.nav.${id}`)}
            onClick={() => onNavigate(id)}
          >
            <Icon variant="solid" size={22} />
            <span className="v-tip" aria-hidden="true">
              {t(`vobi.nav.${id}`)}
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
};
