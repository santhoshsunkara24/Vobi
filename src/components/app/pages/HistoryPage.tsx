import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileAudio,
  FolderOpen,
  History,
  Search,
  Star,
  Upload,
} from "@hexline/bicon/react";
import { commands } from "@/bindings";
import { notify } from "@/stores/noticeStore";
import { AudioPlayerGroup } from "@/components/ui/AudioPlayer";
import {
  pickAndTranscribeFiles,
  useFileReadsStore,
} from "@/components/settings/history/transcribeFiles";
import { HistoryRow } from "../HistoryRow";
import { ChipButton, Divider, PageFrame } from "../PageFrame";
import {
  entryText,
  startOfDay,
  useHistoryFeed,
  useHistorySummary,
} from "../useHistoryFeed";

const DAY = 86_400_000;
const ICON = { size: 20, strokeWidth: 1.5 } as const;

type Filter = "all" | "saved" | "files";

/** Everything said, newest first, grouped by day, searchable. */
export const HistoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const feed = useHistoryFeed();
  const summary = useHistorySummary(
    `${feed.entries[0]?.id}:${feed.entries.length}:${feed.entries.filter((e) => e.saved).length}`,
  );
  const reads = useFileReadsStore((s) => s.reads);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const sentinel = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const number = new Intl.NumberFormat(i18n.language);

  // Search and filters cover everything: page through the rest.
  useEffect(() => {
    if ((q || filter !== "all") && feed.hasMore && !feed.loading)
      feed.loadMore();
  }, [q, filter, feed.hasMore, feed.loading, feed.entries.length]);

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
      feed.entries.filter(
        (e) =>
          (filter === "all" ||
            (filter === "saved" && e.saved) ||
            (filter === "files" && e.source_name)) &&
          (!q ||
            entryText(e).toLowerCase().includes(q) ||
            (e.source_name ?? "").toLowerCase().includes(q)),
      ),
    [feed.entries, q, filter],
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

  const toggle = (next: Filter) => setFilter(filter === next ? "all" : next);

  return (
    <PageFrame
      title={t("vobi.history.title")}
      count={
        summary
          ? t("vobi.history.count", {
              count: summary.total,
              n: number.format(summary.total) + (summary.capped ? "+" : ""),
            })
          : null
      }
      side={
        <label className="v-search">
          <Search size={16} strokeWidth={1.6} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder={t("vobi.history.search")}
            aria-label={t("vobi.history.search")}
          />
        </label>
      }
      actions={
        <>
          <button type="button" className="v-pill" onClick={transcribeFile}>
            <Upload {...ICON} />
            {t("settings.history.transcribeFile")}
          </button>
          <Divider />
          <ChipButton
            icon={<History {...ICON} />}
            n={summary ? number.format(summary.total) : null}
            pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            {t("vobi.history.filters.all")}
          </ChipButton>
          <ChipButton
            icon={<Star {...ICON} />}
            n={summary ? number.format(summary.saved) : null}
            pressed={filter === "saved"}
            onClick={() => toggle("saved")}
          >
            {t("vobi.history.filters.saved")}
          </ChipButton>
          <ChipButton
            icon={<FileAudio {...ICON} />}
            n={summary ? number.format(summary.files) : null}
            pressed={filter === "files"}
            onClick={() => toggle("files")}
          >
            {t("vobi.history.filters.files")}
          </ChipButton>
          <ChipButton icon={<FolderOpen {...ICON} />} onClick={openFolder}>
            {t("vobi.history.folder")}
          </ChipButton>
        </>
      }
    >
      {reads.length > 0 && (
        <section className="v-card v-list mb-[20px]">
          {reads.map((read) => (
            <div key={read.id} className="v-row">
              <span className="v-badge" data-tone="file" aria-hidden="true">
                <FileAudio size={20} strokeWidth={1.5} />
              </span>
              <div className="v-row-main">
                <div className="v-row-top">
                  <b>{read.name}</b>
                </div>
                <p className="v-row-text italic">
                  {t("settings.history.readingFile")}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      {feed.loading ? null : feed.entries.length === 0 && reads.length === 0 ? (
        <div className="v-card v-empty">{t("settings.history.empty")}</div>
      ) : shown.length === 0 ? (
        <div className="v-card v-empty">
          {q
            ? t("vobi.history.noMatch", { query: query.trim() })
            : t("vobi.history.noneHere")}
        </div>
      ) : (
        <AudioPlayerGroup>
          {days.map((group) => (
            <div key={group.day} className="v-day-group">
              <div className="v-day">{dayLabel(group.day)}</div>
              <section className="v-card v-list">
                {group.items.map((entry) => (
                  <HistoryRow
                    key={entry.id}
                    entry={entry}
                    query={query}
                    timeOnly
                    fresh={feed.fresh.has(entry.id)}
                    onToggleSaved={() => feed.toggleSaved(entry.id)}
                    onDelete={() => feed.remove(entry.id)}
                  />
                ))}
              </section>
            </div>
          ))}
        </AudioPlayerGroup>
      )}
      <div ref={sentinel} className="h-px" />
    </PageFrame>
  );
};
