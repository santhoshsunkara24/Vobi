import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileAudio, FolderOpen } from "lucide-react";
import { commands } from "@/bindings";
import { notify } from "@/stores/noticeStore";
import { AudioPlayerGroup } from "@/components/ui/AudioPlayer";
import {
  pickAndTranscribeFiles,
  useFileReadsStore,
} from "@/components/settings/history/transcribeFiles";
import { HistoryCard } from "../HistoryCard";
import { SearchIcon, UploadIcon } from "../icons";
import { entryText, startOfDay, useHistoryFeed } from "../useHistoryFeed";

const DAY = 86_400_000;

/** Everything said, newest first, grouped by day, searchable. */
export const HistoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const feed = useHistoryFeed();
  const reads = useFileReadsStore((s) => s.reads);
  const [query, setQuery] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();

  // Search covers everything: page through the rest while a query is typed.
  useEffect(() => {
    if (q && feed.hasMore && !feed.loading) feed.loadMore();
  }, [q, feed.hasMore, feed.loading, feed.entries.length]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !feed.hasMore || feed.loading) return;
    const observer = new IntersectionObserver((items) => {
      if (items[0].isIntersecting) feed.loadMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [feed.hasMore, feed.loading, feed.loadMore]);

  const shown = useMemo(
    () =>
      q
        ? feed.entries.filter(
            (e) =>
              entryText(e).toLowerCase().includes(q) ||
              (e.source_name ?? "").toLowerCase().includes(q),
          )
        : feed.entries,
    [feed.entries, q],
  );

  const days = useMemo(() => {
    const groups: { day: number; items: typeof shown }[] = [];
    for (const entry of shown) {
      const day = startOfDay(entry.timestamp * 1000);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(entry);
      else groups.push({ day, items: [entry] });
    }
    return groups;
  }, [shown]);

  const today = startOfDay(Date.now());
  const dayLabel = (day: number) =>
    day === today
      ? t("vobi.history.today")
      : day === startOfDay(today - DAY / 2)
        ? t("vobi.history.yesterday")
        : new Intl.DateTimeFormat(i18n.language, {
            weekday: "long",
            month: "long",
            day: "numeric",
          }).format(new Date(day));

  const transcribeFile = async () => {
    try {
      await pickAndTranscribeFiles();
    } catch (error) {
      console.error("Failed to pick a file to transcribe:", error);
      notify({ title: t("settings.history.transcribeFailed") });
    }
  };

  const openFolder = async () => {
    try {
      const result = await commands.openRecordingsFolder();
      if (result.status !== "ok") throw new Error(String(result.error));
    } catch (error) {
      console.error("Failed to open recordings folder:", error);
    }
  };

  return (
    <section className="v-page">
      <div className="v-top flex-wrap">
        <div className="min-w-[200px] flex-1">
          <h1>{t("vobi.history.title")}</h1>
          <div className="v-sub">{t("vobi.history.sub")}</div>
        </div>
        <label className="v-search">
          <SearchIcon size={15} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder={t("vobi.history.search")}
            aria-label={t("vobi.history.search")}
          />
        </label>
      </div>

      <div className="mb-[20px] flex gap-[8px]">
        <button
          type="button"
          className="v-btn v-btn-white v-btn-sm"
          onClick={transcribeFile}
        >
          <UploadIcon size={15} />
          {t("settings.history.transcribeFile")}
        </button>
        <button
          type="button"
          className="v-btn v-btn-quiet"
          onClick={openFolder}
        >
          <FolderOpen size={15} strokeWidth={1.8} />
          {t("settings.history.openFolder")}
        </button>
      </div>

      {reads.map((read) => (
        <div key={read.id} className="v-card v-rec mb-[12px]">
          <div className="v-rec-h">
            <span className="v-tile" aria-hidden="true">
              <FileAudio size={18} strokeWidth={1.7} />
            </span>
            <div className="min-w-0">
              <b className="truncate">{read.name}</b>
              <div className="v-meta">
                <span>{t("settings.history.readingFile")}</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {feed.loading ? null : feed.entries.length === 0 && reads.length === 0 ? (
        <div className="v-empty">{t("settings.history.empty")}</div>
      ) : shown.length === 0 && q ? (
        <div className="v-empty">
          {t("vobi.history.noMatch", { query: query.trim() })}
        </div>
      ) : (
        <AudioPlayerGroup>
          {days.map((group) => (
            <div key={group.day}>
              <div className="v-day">{dayLabel(group.day)}</div>
              <div className="v-rec-list">
                {group.items.map((entry) => (
                  <HistoryCard
                    key={entry.id}
                    entry={entry}
                    query={query}
                    fresh={feed.fresh.has(entry.id)}
                    onToggleSaved={() => feed.toggleSaved(entry.id)}
                    onDelete={() => feed.remove(entry.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </AudioPlayerGroup>
      )}
      <div ref={sentinel} className="h-px" />
    </section>
  );
};
