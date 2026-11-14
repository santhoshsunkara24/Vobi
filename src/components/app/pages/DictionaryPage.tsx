import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, SpellCheck, X } from "@hexline/bicon/react";
import { notify } from "@/stores/noticeStore";
import { useSettings } from "@/hooks/useSettings";
import { isComposingKeyEvent } from "@/lib/utils/keyboard";
import { PageFrame } from "../PageFrame";

const MAX_LENGTH = 50;

const normalize = (word: string) =>
  word
    .replace(/[<>"']/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Words Vobi should always spell right: Handy's `custom_words` setting. */
export const DictionaryPage: React.FC<{ autoFocus?: boolean }> = ({
  autoFocus = false,
}) => {
  const { t, i18n } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const words = getSetting("custom_words") ?? [];
  const [draft, setDraft] = useState("");
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const word = normalize(draft);
  const busy = isUpdating("custom_words");

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const add = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!word || word.length > MAX_LENGTH) {
      inputRef.current?.focus();
      return;
    }
    if (words.some((w) => w.toLowerCase() === word.toLowerCase())) {
      notify({ title: t("settings.advanced.customWords.duplicate", { word }) });
      return;
    }
    updateSetting("custom_words", [...words, word]);
    setDraft("");
  };

  const remove = (target: string) => {
    setLeaving((prev) => new Set(prev).add(target));
    // Let the chip shrink away before the list closes the gap.
    setTimeout(() => {
      updateSetting(
        "custom_words",
        (getSetting("custom_words") ?? []).filter((w) => w !== target),
      );
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(target);
        return next;
      });
    }, 160);
  };

  return (
    <PageFrame
      title={t("vobi.dictionary.title")}
      count={t("vobi.dictionary.count", {
        count: words.length,
        n: new Intl.NumberFormat(i18n.language).format(words.length),
      })}
      actions={
        <button
          type="button"
          className="v-pill"
          onClick={() => add()}
          disabled={busy}
        >
          <Plus size={20} strokeWidth={1.6} />
          {t("vobi.dictionary.add")}
        </button>
      }
    >
      <div className="v-stack">
        <section className="v-card v-card-pad">
          <form onSubmit={add} className="mb-[20px] flex gap-[10px]">
            <input
              ref={inputRef}
              className="v-field max-w-[420px] flex-1"
              value={draft}
              maxLength={MAX_LENGTH + 10}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (isComposingKeyEvent(e.nativeEvent) && e.key === "Enter")
                  e.preventDefault();
              }}
              placeholder={t("vobi.dictionary.placeholder")}
              aria-label={t("vobi.dictionary.placeholder")}
              disabled={busy}
            />
          </form>
          {words.length > 0 ? (
            <div className="v-chips">
              {words.map((w) => (
                <span
                  key={w}
                  className={`v-chip ${leaving.has(w) ? "v-out" : ""}`}
                >
                  {w}
                  <button
                    type="button"
                    onClick={() => remove(w)}
                    aria-label={t("settings.advanced.customWords.remove", {
                      word: w,
                    })}
                  >
                    <X size={14} strokeWidth={1.8} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="m-0 text-[15px] text-ink-3">
              {t("vobi.dictionary.empty")}
            </p>
          )}
        </section>

        <section className="v-card flex items-center gap-[16px] px-[28px] py-[20px]">
          <span className="v-badge" aria-hidden="true">
            <SpellCheck size={20} strokeWidth={1.5} />
          </span>
          <div>
            <b className="block text-[16px] font-medium">
              {t("vobi.dictionary.tipTitle")}
            </b>
            <span className="text-[14.5px] text-ink-3">
              {t("vobi.dictionary.tipBody")}
            </span>
          </div>
        </section>
      </div>
    </PageFrame>
  );
};
