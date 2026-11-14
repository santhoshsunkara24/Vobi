import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { convertFileSrc } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  Check,
  Copy,
  FileAudio,
  Mic,
  RotateCcw,
  Star,
  Trash,
  X,
} from "@hexline/bicon/react";
import { commands, type HistoryEntry } from "@/bindings";
import { notify } from "@/stores/noticeStore";
import { useOsType } from "@/hooks/useOsType";
import { useTranscriptionJobsStore } from "@/stores/transcriptionJobsStore";
import { copyToClipboard } from "@/components/settings/history/clipboard";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { entryText, startOfDay } from "./useHistoryFeed";

interface HistoryRowProps {
  entry: HistoryEntry;
  /** Arrived live: slides in. */
  fresh?: boolean;
  /** Text to highlight (History search). */
  query?: string;
  /** Under a day heading: show the time even for older days. */
  timeOnly?: boolean;
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

const ICON = { size: 18, strokeWidth: 1.5 } as const;

/**
 * One transcription in a list: a badge, what it was, when, and two lines of
 * what was said. Clicking opens it: the full text, its audio and actions.
 */
export const HistoryRow: React.FC<HistoryRowProps> = ({
  entry,
  fresh = false,
  query = "",
  timeOnly = false,
  onToggleSaved,
  onDelete,
}) => {
  const { t, i18n } = useTranslation();
  const osType = useOsType();
  const job = useTranscriptionJobsStore((s) => s.jobs[entry.id]);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const text = entryText(entry);
  const retrying = job !== undefined;
  const ms = entry.timestamp * 1000;
  const when = new Intl.DateTimeFormat(
    i18n.language,
    timeOnly || startOfDay(ms) === startOfDay(Date.now())
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric" },
  ).format(new Date(ms));
  const time = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));

  const copy = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  const body = retrying
    ? status
    : text
      ? highlight(text, query)
      : entry.source_name
        ? t("settings.history.notTranscribed")
        : t("settings.history.transcriptionFailed");

  const copyLabel = t("settings.history.copyToClipboard");
  const saveLabel = t(
    entry.saved ? "settings.history.unsave" : "settings.history.save",
  );

  return (
    <div
      className={`v-row cursor-pointer ${fresh ? "v-new" : ""}`}
      data-open={open || undefined}
      onClick={(e) => {
        // Selecting text shouldn't fold the row.
        if (window.getSelection()?.toString()) return;
        if ((e.target as HTMLElement).closest("button, audio, input")) return;
        setOpen(!open);
      }}
    >
      <span
        className="v-badge"
        data-tone={entry.source_name ? "file" : undefined}
        aria-hidden="true"
      >
        {entry.source_name ? (
          <FileAudio size={20} strokeWidth={1.5} />
        ) : (
          <Mic size={20} strokeWidth={1.5} />
        )}
      </span>
      <div className="v-row-main">
        <div className="v-row-top">
          <b title={entry.source_name ?? undefined}>
            {entry.source_name ?? t("vobi.history.dictation")}
          </b>
          {entry.saved && (
            <Star
              variant="solid"
              size={14}
              color="var(--amber)"
              title={t("vobi.history.saved")}
            />
          )}
          <span className="v-when" title={time}>
            {!open && (
              <span className="v-row-hover">
                <button
                  type="button"
                  className="v-icon-btn"
                  onClick={copy}
                  disabled={!text || retrying}
                  aria-label={copyLabel}
                  title={copyLabel}
                >
                  {copied ? (
                    <Check {...ICON} color="var(--green)" />
                  ) : (
                    <Copy {...ICON} />
                  )}
                </button>
              </span>
            )}
            {when}
          </span>
        </div>
        <p
          className={`v-row-text ${retrying || !text ? "italic" : ""}`}
          data-clamp={open ? undefined : ""}
        >
          {body}
        </p>
        {open && (
          <div className="animate-rise">
            <AudioPlayer
              onLoadRequest={loadAudio}
              className="mt-[14px] w-full"
            />
            <div className="v-row-tools">
              <button
                type="button"
                className="v-icon-btn"
                onClick={() => void copy()}
                disabled={!text || retrying}
                aria-label={copyLabel}
                title={copyLabel}
              >
                {copied ? (
                  <Check {...ICON} color="var(--green)" />
                ) : (
                  <Copy {...ICON} />
                )}
              </button>
              <button
                type="button"
                className="v-icon-btn"
                onClick={onToggleSaved}
                aria-pressed={entry.saved}
                aria-label={saveLabel}
                title={saveLabel}
              >
                <Star {...ICON} variant={entry.saved ? "solid" : "stroke"} />
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
                  <X {...ICON} />
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
                  <RotateCcw {...ICON} />
                </button>
              )}
              <button
                type="button"
                className="v-icon-btn"
                onClick={remove}
                aria-label={t("settings.history.delete")}
                title={t("settings.history.delete")}
              >
                <Trash {...ICON} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
