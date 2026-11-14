import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { convertFileSrc } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  Check,
  Copy,
  FileAudio,
  RotateCcw,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { commands, type HistoryEntry } from "@/bindings";
import { notify } from "@/stores/noticeStore";
import { useOsType } from "@/hooks/useOsType";
import { useTranscriptionJobsStore } from "@/stores/transcriptionJobsStore";
import { copyToClipboard } from "@/components/settings/history/clipboard";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { MicIcon } from "./icons";
import { entryText, wordCount } from "./useHistoryFeed";

interface HistoryCardProps {
  entry: HistoryEntry;
  /** Arrived live: springs in. */
  fresh?: boolean;
  /** Text to highlight (History search). */
  query?: string;
  /** Home's Recent list: no audio player. */
  compact?: boolean;
  onToggleSaved: () => void;
  onDelete: () => Promise<void>;
}

/** Wraps each match of `query` in <mark>. */
const highlight = (text: string, query: string): React.ReactNode => {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(needle);
  while (at !== -1) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(<mark key={at}>{text.slice(at, at + q.length)}</mark>);
    from = at + q.length;
    at = lower.indexOf(needle, from);
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
};

/** One transcription: what it was, when, and what you said. */
export const HistoryCard: React.FC<HistoryCardProps> = ({
  entry,
  fresh = false,
  query = "",
  compact = false,
  onToggleSaved,
  onDelete,
}) => {
  const { t, i18n } = useTranslation();
  const osType = useOsType();
  const job = useTranscriptionJobsStore((s) => s.jobs[entry.id]);
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const text = entryText(entry);
  const retrying = job !== undefined;
  const words = wordCount(text);
  const time = new Intl.DateTimeFormat(i18n.language, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(entry.timestamp * 1000));

  const copy = async () => {
    if (!text) return;
    if (!(await copyToClipboard(text))) {
      notify({ title: t("settings.history.copyError") });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const remove = async () => {
    try {
      await onDelete();
    } catch (error) {
      console.error("Failed to delete entry:", error);
      notify({ title: t("settings.history.deleteError") });
    }
  };

  const loadAudio = useCallback(async () => {
    try {
      const result = await commands.getAudioFilePath(entry.file_name);
      if (result.status !== "ok") return null;
      if (osType === "linux") {
        const data = await readFile(result.data);
        return URL.createObjectURL(new Blob([data], { type: "audio/wav" }));
      }
      return convertFileSrc(result.data, "asset");
    } catch (error) {
      console.error("Failed to get audio file path:", error);
      return null;
    }
  }, [entry.file_name, osType]);

  let status = t("settings.history.transcribing");
  if (job?.state === "queued") status = t("settings.history.waiting");
  else if (job?.state === "running" && job.percent > 0)
    status = t("settings.history.transcribingPercent", {
      percent: job.percent,
    });

  const long = text.length > 280;

  return (
    <article className={`v-card v-rec ${fresh ? "v-new" : ""}`}>
      <div className="v-rec-h">
        <span className="v-tile" aria-hidden="true">
          {entry.source_name ? (
            <FileAudio size={18} strokeWidth={1.7} />
          ) : (
            <MicIcon size={18} />
          )}
        </span>
        <div className="min-w-0">
          <b className="truncate" title={entry.source_name ?? undefined}>
            {entry.source_name ?? t("vobi.history.dictation")}
          </b>
          <div className="v-meta">
            <span>{time}</span>
            {words > 0 && (
              <span>
                {t(words === 1 ? "vobi.history.word" : "vobi.history.words", {
                  count: words,
                })}
              </span>
            )}
            {entry.saved && (
              <span className="text-[var(--amber)]">
                <Star size={11} fill="currentColor" aria-hidden="true" />
                {t("vobi.history.saved")}
              </span>
            )}
          </div>
        </div>
        <div className="v-more">
          <button
            type="button"
            className="v-icon-btn"
            onClick={copy}
            disabled={!text || retrying}
            aria-label={t("settings.history.copyToClipboard")}
            title={t("settings.history.copyToClipboard")}
          >
            {copied ? (
              <Check size={16} className="text-[var(--green)]" />
            ) : (
              <Copy size={16} />
            )}
          </button>
          <button
            type="button"
            className="v-icon-btn"
            onClick={onToggleSaved}
            aria-pressed={entry.saved}
            aria-label={t(
              entry.saved ? "settings.history.unsave" : "settings.history.save",
            )}
            title={t(
              entry.saved ? "settings.history.unsave" : "settings.history.save",
            )}
          >
            <Star size={16} fill={entry.saved ? "currentColor" : "none"} />
          </button>
          {retrying ? (
            <button
              type="button"
              className="v-icon-btn"
              disabled={cancelling}
              onClick={() => {
                setCancelling(true);
                void commands.cancelHistoryEntryTranscription(entry.id);
              }}
              aria-label={t("settings.history.cancelTranscription")}
              title={t("settings.history.cancelTranscription")}
            >
              <X size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="v-icon-btn"
              onClick={() => {
                setCancelling(false);
                void commands.retryHistoryEntryTranscription(entry.id);
              }}
              aria-label={t("settings.history.retranscribe")}
              title={t("settings.history.retranscribe")}
            >
              <RotateCcw size={16} />
            </button>
          )}
          <button
            type="button"
            className="v-icon-btn"
            onClick={remove}
            aria-label={t("settings.history.delete")}
            title={t("settings.history.delete")}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div
        className={`v-rec-body ${retrying || !text ? "italic text-ink-3" : ""}`}
        style={
          !retrying && text && long && !expanded
            ? {
                display: "-webkit-box",
                WebkitLineClamp: compact ? 3 : 5,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
            : undefined
        }
      >
        {retrying
          ? status
          : text
            ? highlight(text, query)
            : entry.source_name
              ? t("settings.history.notTranscribed")
              : t("settings.history.transcriptionFailed")}
      </div>
      {!retrying && text && long && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-[6px] ms-[14px] cursor-pointer text-[12.5px] font-semibold text-ink-3 hover:text-accent-text"
        >
          {t(
            expanded
              ? "settings.history.showLess"
              : "settings.history.showMore",
          )}
        </button>
      )}
      {!compact && (
        <AudioPlayer
          onLoadRequest={loadAudio}
          className="mt-[10px] w-full px-[4px]"
        />
      )}
    </article>
  );
};
