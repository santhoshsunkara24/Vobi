import { useCallback, useEffect, useRef, useState } from "react";
import { commands, events, type HistoryEntry } from "@/bindings";

const PAGE_SIZE = 30;

/**
 * Transcription history, newest first, kept live: new and updated entries
 * arrive from the pipeline as `historyUpdatePayload` events.
 */
export function useHistoryFeed(pageSize = PAGE_SIZE) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  /** Ids that arrived live, so they can animate in. */
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const loadingRef = useRef(false);
  const entriesRef = useRef<HistoryEntry[]>([]);
  entriesRef.current = entries;

  const loadPage = useCallback(
    async (cursor?: number) => {
      const first = cursor === undefined;
      if (!first && loadingRef.current) return;
      loadingRef.current = true;
      if (first) setLoading(true);
      try {
        const result = await commands.getHistoryEntries(
          cursor ?? null,
          pageSize,
        );
        if (result.status === "ok") {
          const { entries: page, has_more } = result.data;
          setEntries((prev) => {
            if (first) return page;
            const seen = new Set(prev.map((e) => e.id));
            return [...prev, ...page.filter((e) => !seen.has(e.id))];
          });
          setHasMore(has_more);
        }
      } catch (error) {
        console.error("Failed to load history entries:", error);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [pageSize],
  );

  const loadMore = useCallback(() => {
    const last = entriesRef.current[entriesRef.current.length - 1];
    if (last) loadPage(last.id);
  }, [loadPage]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    const unlisten = events.historyUpdatePayload.listen(({ payload }) => {
      if (payload.action === "added") {
        setEntries((prev) => [
          payload.entry,
          ...prev.filter((e) => e.id !== payload.entry.id),
        ]);
        setFresh((prev) => new Set(prev).add(payload.entry.id));
      } else if (payload.action === "updated") {
        setEntries((prev) =>
          prev.map((e) => (e.id === payload.entry.id ? payload.entry : e)),
        );
      } else if (payload.action === "deleted") {
        setEntries((prev) => prev.filter((e) => e.id !== payload.id));
      }
      // "toggled" is applied optimistically by whoever toggled it.
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const toggleSaved = useCallback(async (id: number) => {
    const flip = () =>
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, saved: !e.saved } : e)),
      );
    flip();
    try {
      const result = await commands.toggleHistoryEntrySaved(id);
      if (result.status !== "ok") flip();
    } catch (error) {
      console.error("Failed to toggle saved status:", error);
      flip();
    }
  }, []);

  /** Removes the entry; rejects (after reloading) if the backend refused. */
  const remove = useCallback(
    async (id: number) => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      try {
        const result = await commands.deleteHistoryEntry(id);
        if (result.status !== "ok") throw new Error(String(result.error));
      } catch (error) {
        loadPage();
        throw error;
      }
    },
    [loadPage],
  );

  return {
    entries,
    loading,
    hasMore,
    fresh,
    loadMore,
    reload: () => loadPage(),
    toggleSaved,
    remove,
  };
}

/** The text an entry produced: the post-processed version when there is one. */
export const entryText = (entry: HistoryEntry): string =>
  (entry.post_processed_text?.trim() || entry.transcription_text).trim();

export const wordCount = (text: string): number => {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // CJK has no spaces: count characters there, words elsewhere.
  const cjk = trimmed.match(/[぀-ヿ㐀-鿿가-힯]/g);
  const words = trimmed
    .replace(/[぀-ヿ㐀-鿿가-힯]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return words + (cjk?.length ?? 0);
};

const DAY = 86_400_000;

/** Midnight (local) of the day `ms` falls in. */
export const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export interface HistorySummary {
  /** Entries on disk (counted up to a cap; see `capped`). */
  total: number;
  saved: number;
  files: number;
  /** Words in the last 7 days. */
  wordsWeek: number;
  /** Words per calendar day of this month, index 0 = the 1st. */
  monthDays: number[];
  /** The count stopped at the cap, so `total` is a lower bound. */
  capped: boolean;
}

const SUMMARY_PAGES = 20;
const SUMMARY_PAGE_SIZE = 100;

/**
 * Counts and this month's words per day, from the history on disk. Re-runs
 * when `refreshKey` changes (e.g. the newest entry's id).
 */
export function useHistorySummary(refreshKey: unknown): HistorySummary | null {
  const [summary, setSummary] = useState<HistorySummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const all: HistoryEntry[] = [];
      let cursor: number | null = null;
      let capped = false;
      for (let page = 0; ; page++) {
        if (page === SUMMARY_PAGES) {
          capped = true;
          break;
        }
        const result = await commands.getHistoryEntries(
          cursor,
          SUMMARY_PAGE_SIZE,
        );
        if (result.status !== "ok") break;
        all.push(...result.data.entries);
        const last = result.data.entries[result.data.entries.length - 1];
        if (!result.data.has_more || !last) break;
        cursor = last.id;
      }
      if (cancelled) return;

      const now = new Date();
      const weekAgo = now.getTime() - 7 * DAY;
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      const monthDays = new Array<number>(daysInMonth).fill(0);
      let wordsWeek = 0;
      for (const entry of all) {
        const ms = entry.timestamp * 1000;
        const n = wordCount(entryText(entry));
        if (ms >= weekAgo) wordsWeek += n;
        if (ms >= monthStart.getTime()) {
          const day = new Date(ms).getDate() - 1;
          if (day < daysInMonth) monthDays[day] += n;
        }
      }
      setSummary({
        total: all.length,
        saved: all.filter((e) => e.saved).length,
        files: all.filter((e) => e.source_name).length,
        wordsWeek,
        monthDays,
        capped,
      });
    };
    run().catch((e) => console.error("Failed to summarise history:", e));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return summary;
}

/** Bumps whenever history changes, to refresh anything derived from it. */
export function useHistoryVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const unlisten = events.historyUpdatePayload.listen(() =>
      setVersion((v) => v + 1),
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
  return version;
}
