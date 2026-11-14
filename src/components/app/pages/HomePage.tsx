import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Book,
  FilterList,
  History,
  Mic,
  Waveform,
  X,
  Zap,
} from "@hexline/bicon/react";
import { VobiCloud } from "@/components/vobi/VobiCloud";
import { useSettings } from "@/hooks/useSettings";
import { useModelStore } from "@/stores/modelStore";
import { getTranslatedModelName } from "@/lib/utils/modelTranslation";
import { HotkeyKbd } from "../Hotkey";
import { ChipButton, Divider, PageFrame } from "../PageFrame";
import { HistoryRow } from "../HistoryRow";
import { useNav } from "../nav";
import {
  useHistoryFeed,
  useHistorySummary,
  type HistorySummary,
} from "../useHistoryFeed";

const BANNER_KEY = "vobi.banner.dismissed";

const dismissedBanners = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(BANNER_KEY) ?? "[]");
  } catch {
    return [];
  }
};

export const HomePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNav();
  const { getSetting, updateSetting } = useSettings();
  const feed = useHistoryFeed(4);
  const summary = useHistorySummary(feed.entries[0]?.id);
  const [trying, setTrying] = useState(false);
  const tryRef = useRef<HTMLTextAreaElement>(null);
  const [dismissed, setDismissed] = useState(dismissedBanners);
  const number = new Intl.NumberFormat(i18n.language);

  useEffect(() => {
    if (trying) tryRef.current?.focus();
  }, [trying]);

  const words = getSetting("custom_words") ?? [];
  const snippets = getSetting("snippets") ?? [];
  const cleanUp = getSetting("filler_word_removal_enabled") ?? true;

  // One suggestion at a time: clean-up if it's off, else the Dictionary.
  const banner = !cleanUp
    ? "cleanup"
    : words.length === 0
      ? "dictionary"
      : null;
  const showBanner = banner && !dismissed.includes(banner);
  const dismiss = () => {
    if (!banner) return;
    const next = [...dismissed, banner];
    setDismissed(next);
    try {
      localStorage.setItem(BANNER_KEY, JSON.stringify(next));
    } catch {
      // Not remembered across launches; it's only a suggestion.
    }
  };

  return (
    <PageFrame
      title={t("vobi.nav.home")}
      count={
        summary && summary.wordsWeek > 0
          ? t("vobi.home.countWeek", {
              count: summary.wordsWeek,
              n: number.format(summary.wordsWeek),
            })
          : null
      }
      actions={
        <>
          <button
            type="button"
            className="v-pill"
            onClick={() => (trying ? tryRef.current?.focus() : setTrying(true))}
          >
            <Mic size={20} strokeWidth={1.5} />
            {t("vobi.home.actions.dictate")}
          </button>
          <Divider />
          <ChipButton
            icon={<History size={20} strokeWidth={1.5} />}
            n={summary ? number.format(summary.total) : null}
            onClick={() => navigate("history")}
          >
            {t("vobi.nav.history")}
          </ChipButton>
          <ChipButton
            icon={<Book size={20} strokeWidth={1.5} />}
            n={number.format(words.length)}
            onClick={() => navigate("dictionary")}
          >
            {t("vobi.nav.dictionary")}
          </ChipButton>
          <ChipButton
            icon={<Zap size={20} strokeWidth={1.5} />}
            n={number.format(snippets.length)}
            onClick={() => navigate("snippets")}
          >
            {t("vobi.nav.snippets")}
          </ChipButton>
        </>
      }
    >
      <div className="v-stack">
        {trying && (
          <div className="v-card animate-rise p-[20px]">
            <div className="mb-[12px] flex items-center gap-[10px] text-[15px] font-medium">
              <span className="v-live" aria-hidden="true" />
              <span className="flex-1">
                {t("vobi.home.try.before")} <HotkeyKbd />{" "}
                {t("vobi.home.try.after")}
              </span>
              <button
                type="button"
                className="v-icon-btn"
                onClick={() => setTrying(false)}
                aria-label={t("vobi.home.try.close")}
                title={t("vobi.home.try.close")}
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            <textarea
              ref={tryRef}
              rows={3}
              className="v-field w-full"
              placeholder={t("vobi.home.try.placeholder")}
            />
          </div>
        )}

        <UsageCard summary={summary} />

        <section className="v-card v-list">
          <div className="v-list-h">
            <h2>{t("vobi.home.recent")}</h2>
            <button
              type="button"
              className="v-icon-btn"
              onClick={() => navigate("history")}
              aria-label={t("vobi.home.viewAll")}
              title={t("vobi.home.viewAll")}
            >
              <FilterList size={20} strokeWidth={1.5} />
            </button>
          </div>

          {showBanner && (
            <div className="v-banner">
              <VobiCloud size={52} state="done" />
              <div className="min-w-0 flex-1">
                <b>{t(`vobi.home.banner.${banner}.title`)}</b>
                <p>{t(`vobi.home.banner.${banner}.body`)}</p>
              </div>
              <button
                type="button"
                className="v-banner-go"
                onClick={() => {
                  if (banner === "cleanup")
                    updateSetting("filler_word_removal_enabled", true);
                  else navigate("dictionary", "add");
                }}
              >
                {t(`vobi.home.banner.${banner}.action`)}
              </button>
              <button
                type="button"
                className="v-banner-x"
                onClick={dismiss}
                aria-label={t("vobi.home.banner.dismiss")}
                title={t("vobi.home.banner.dismiss")}
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>
          )}

          {feed.loading ? null : feed.entries.length === 0 ? (
            <div className="v-empty">
              {t("vobi.home.emptyBefore")} <HotkeyKbd />{" "}
              {t("vobi.home.emptyAfter")}
            </div>
          ) : (
            <div>
              {feed.entries.slice(0, 4).map((entry) => (
                <HistoryRow
                  key={entry.id}
                  entry={entry}
                  fresh={feed.fresh.has(entry.id)}
                  onToggleSaved={() => feed.toggleSaved(entry.id)}
                  onDelete={() => feed.remove(entry.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </PageFrame>
  );
};

/** The speech model, and this month's words as a row of day bars. */
const UsageCard: React.FC<{ summary: HistorySummary | null }> = ({
  summary,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNav();
  const currentModel = useModelStore((s) => s.currentModel);
  const model = useModelStore((s) =>
    s.models.find((m) => m.id === s.currentModel),
  );
  const name = model
    ? getTranslatedModelName(model, t)
    : currentModel || t("vobi.home.usage.noModel");

  const today = new Date().getDate();
  const days = summary?.monthDays ?? [];
  const max = Math.max(1, ...days);
  const dayLabel = (day: number) =>
    new Intl.DateTimeFormat(i18n.language, {
      month: "short",
      day: "numeric",
    }).format(new Date(new Date().getFullYear(), new Date().getMonth(), day));

  return (
    <button
      type="button"
      className="v-card v-usage text-start transition-colors hover:border-[var(--border-2)]"
      onClick={() => navigate("settings", "model")}
      title={t("vobi.home.usage.change")}
    >
      <span className="v-usage-ico" aria-hidden="true">
        <Waveform size={22} strokeWidth={1.6} />
      </span>
      <span className="v-usage-t">
        <b>{name}</b>
        <span>{t("vobi.home.usage.onDevice")}</span>
      </span>
      {days.length > 0 && (
        <span
          className="v-bars"
          role="img"
          aria-label={t("vobi.home.usage.bars")}
        >
          {days.map((words, i) => {
            const day = i + 1;
            const future = day > today;
            return (
              <i
                key={day}
                data-future={future || undefined}
                data-empty={(!future && words === 0) || undefined}
                title={
                  future
                    ? dayLabel(day)
                    : t("vobi.home.usage.day", {
                        day: dayLabel(day),
                        count: words,
                      })
                }
                style={{
                  // Busier days read stronger; quiet ones stay a soft tint.
                  opacity:
                    future || words === 0 ? 1 : 0.45 + (0.55 * words) / max,
                  animationDelay: `${i * 12}ms`,
                }}
              />
            );
          })}
        </span>
      )}
    </button>
  );
};
