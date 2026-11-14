import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { VobiCloud } from "@/components/vobi/VobiCloud";
import { notify } from "@/stores/noticeStore";
import { pickAndTranscribeFiles } from "@/components/settings/history/transcribeFiles";
import { HotkeyKbd } from "../Hotkey";
import type { Page } from "../AppSidebar";
import {
  AddWordIcon,
  ArrowIcon,
  BoltIcon,
  MicIcon,
  SearchIcon,
  UploadIcon,
} from "../icons";
import { useHistoryFeed, useWeekStats } from "../useHistoryFeed";
import { HistoryCard } from "../HistoryCard";

interface HomePageProps {
  onNavigate: (page: Page, focus?: "add") => void;
}

const greetingKey = (hour: number) =>
  hour < 5
    ? "vobi.home.greeting.evening"
    : hour < 12
      ? "vobi.home.greeting.morning"
      : hour < 18
        ? "vobi.home.greeting.afternoon"
        : "vobi.home.greeting.evening";

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { t, i18n } = useTranslation();
  const feed = useHistoryFeed(3);
  const stats = useWeekStats(feed.entries[0]?.id);
  const [trying, setTrying] = useState(false);
  const tryRef = useRef<HTMLTextAreaElement>(null);
  const now = new Date();

  useEffect(() => {
    if (trying) tryRef.current?.focus();
  }, [trying]);

  const startTrying = () => {
    if (trying) tryRef.current?.focus();
    else setTrying(true);
  };

  const transcribeFile = async () => {
    try {
      const added = await pickAndTranscribeFiles();
      if (added) onNavigate("history");
    } catch (error) {
      console.error("Failed to pick a file to transcribe:", error);
      notify({ title: t("settings.history.transcribeFailed") });
    }
  };

  const number = new Intl.NumberFormat(i18n.language);
  const change =
    stats && stats.wordsLastWeek > 0
      ? Math.round(
          ((stats.words - stats.wordsLastWeek) / stats.wordsLastWeek) * 100,
        )
      : null;

  return (
    <section className="v-page">
      <div className="v-top">
        <div className="flex-1">
          <div className="v-sub">
            {new Intl.DateTimeFormat(i18n.language, {
              weekday: "long",
              month: "long",
              day: "numeric",
            }).format(now)}
          </div>
          <h1>{t(greetingKey(now.getHours()))}</h1>
        </div>
        <button
          type="button"
          className="v-circle-btn"
          aria-label={t("vobi.home.search")}
          onClick={() => onNavigate("history")}
        >
          <SearchIcon />
        </button>
      </div>

      <div className="v-hero">
        <div className="v-bub">
          <VobiCloud size={46} state={trying ? "listening" : "idle"} />
        </div>
        <div className="min-w-0">
          <b>
            {t("vobi.home.hero.before")} <HotkeyKbd />{" "}
            {t("vobi.home.hero.after")}
          </b>
          <p>{t("vobi.home.hero.sub")}</p>
        </div>
        <button
          type="button"
          className="v-go"
          aria-label={t("vobi.home.hero.try")}
          title={t("vobi.home.hero.try")}
          onClick={startTrying}
        >
          <ArrowIcon />
        </button>
      </div>

      {trying && (
        <div className="v-card mb-[26px] animate-rise p-[14px]">
          <div className="mb-[10px] flex items-center gap-[8px] text-[13.5px] font-semibold">
            <span className="v-live" data-tone="busy" aria-hidden="true" />
            <span className="flex-1">
              {t("vobi.home.try.before")} <HotkeyKbd />{" "}
              {t("vobi.home.try.after")}
            </span>
            <button
              type="button"
              className="v-btn v-btn-quiet"
              onClick={() => setTrying(false)}
            >
              {t("vobi.home.try.close")}
            </button>
          </div>
          <textarea
            ref={tryRef}
            rows={3}
            className="v-field w-full bg-surface-2 shadow-none"
            placeholder={t("vobi.home.try.placeholder")}
          />
        </div>
      )}

      <div className="v-sec">
        <h2>{t("vobi.home.quick")}</h2>
      </div>
      <div className="v-card v-actions">
        <button type="button" className="v-action" onClick={startTrying}>
          <span
            className="v-ico"
            style={
              {
                background: "linear-gradient(135deg,#6AD5F9,#2FB1F4)",
                "--c": "rgba(47,177,244,.6)",
              } as React.CSSProperties
            }
          >
            <MicIcon />
          </span>
          {t("vobi.home.actions.dictate")}
        </button>
        <button type="button" className="v-action" onClick={transcribeFile}>
          <span
            className="v-ico"
            style={
              {
                background: "linear-gradient(135deg,#7FB2FF,#3A7BF5)",
                "--c": "rgba(58,123,245,.6)",
              } as React.CSSProperties
            }
          >
            <UploadIcon />
          </span>
          {t("vobi.home.actions.transcribe")}
        </button>
        <button
          type="button"
          className="v-action"
          onClick={() => onNavigate("dictionary", "add")}
        >
          <span
            className="v-ico"
            style={
              {
                background: "linear-gradient(135deg,#8CE4F3,#19B5D6)",
                "--c": "rgba(25,181,214,.6)",
              } as React.CSSProperties
            }
          >
            <AddWordIcon />
          </span>
          {t("vobi.home.actions.addWord")}
        </button>
        <button
          type="button"
          className="v-action"
          onClick={() => onNavigate("snippets", "add")}
        >
          <span
            className="v-ico"
            style={
              {
                background: "linear-gradient(135deg,#A3B8FF,#5B6CF0)",
                "--c": "rgba(91,108,240,.6)",
              } as React.CSSProperties
            }
          >
            <BoltIcon />
          </span>
          {t("vobi.home.actions.snippet")}
        </button>
      </div>

      {stats && (
        <div className="v-stats animate-rise">
          <div className="v-card v-stat">
            <div className="v-l">{t("vobi.home.stats.words")}</div>
            <b>{number.format(stats.words)}</b>
            {change !== null ? (
              <span
                className="v-foot"
                data-tone={change >= 0 ? "up" : undefined}
              >
                {t(
                  change >= 0 ? "vobi.home.stats.up" : "vobi.home.stats.down",
                  { percent: Math.abs(change) },
                )}
              </span>
            ) : (
              <span className="v-foot">{t("vobi.home.stats.thisWeek")}</span>
            )}
          </div>
          <div className="v-card v-stat">
            <div className="v-l">{t("vobi.home.stats.dictations")}</div>
            <b>{number.format(stats.dictations)}</b>
            <span className="v-foot">{t("vobi.home.stats.thisWeek")}</span>
          </div>
          <div className="v-card v-stat">
            <div className="v-l">{t("vobi.home.stats.streak")}</div>
            <b>
              {number.format(stats.streak)}{" "}
              <small>
                {t(
                  stats.streak === 1
                    ? "vobi.home.stats.day"
                    : "vobi.home.stats.days",
                )}
              </small>
            </b>
            <span className="v-foot">{t("vobi.home.stats.inARow")}</span>
          </div>
        </div>
      )}

      <div className="v-sec">
        <h2>{t("vobi.home.recent")}</h2>
        {feed.entries.length > 0 && (
          <button type="button" onClick={() => onNavigate("history")}>
            {t("vobi.home.viewAll")}
          </button>
        )}
      </div>
      {feed.loading ? null : feed.entries.length === 0 ? (
        <div className="v-card v-empty px-6">
          {t("vobi.home.emptyBefore")} <HotkeyKbd /> {t("vobi.home.emptyAfter")}
        </div>
      ) : (
        <div className="v-rec-list">
          {feed.entries.slice(0, 3).map((entry) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              fresh={feed.fresh.has(entry.id)}
              onToggleSaved={() => feed.toggleSaved(entry.id)}
              onDelete={() => feed.remove(entry.id)}
              compact
            />
          ))}
        </div>
      )}
    </section>
  );
};
