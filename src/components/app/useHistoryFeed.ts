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

export interface WeekStats {
  words: number;
  wordsLastWeek: number;
  dictations: number;
  /** Consecutive days with a dictation, ending today (or yesterday). */
  streak: number;
}

/**
 * This week's numbers from the history on disk. Pages back until it has
 * covered two weeks (for the comparison) or run out. Null while loading or
 * when there's nothing this week.
 */
export function useWeekStats(refreshKey: unknown): WeekStats | null {
  const [stats, setStats] = useState<WeekStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const now = Date.now();
      const weekAgo = now - 7 * DAY;
      const twoWeeksAgo = now - 14 * DAY;
      const all: HistoryEntry[] = [];
      let cursor: number | null = null;
      for (let page = 0; page < 20; page++) {
        const result = await commands.getHistoryEntries(cursor, 100);
        if (result.status !== "ok") break;
        all.push(...result.data.entries);
        const last = result.data.entries[result.data.entries.length - 1];
        if (
          !result.data.has_more ||
          !last ||
          last.timestamp * 1000 < twoWeeksAgo
        )
          break;
        cursor = last.id;
      }
      if (cancelled) return;

      let words = 0;
      let wordsLastWeek = 0;
      let dictations = 0;
      const days = new Set<number>();
      for (const entry of all) {
        const ms = entry.timestamp * 1000;
        const n = wordCount(entryText(entry));
        if (n === 0) continue;
        days.add(startOfDay(ms));
        if (ms >= weekAgo) {
          words += n;
          dictations += 1;
        } else if (ms >= twoWeeksAgo) {
          wordsLastWeek += n;
        }
      }
      let streak = 0;
      let day = startOfDay(now);
      if (!days.has(day)) day -= DAY;
      while (days.has(day)) {
        streak += 1;
        day = startOfDay(day - DAY / 2);
      }
      setStats(
        dictations > 0 ? { words, wordsLastWeek, dictations, streak } : null,
      );
    };
    run().catch((e) => console.error("Failed to compute stats:", e));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return stats;
}
