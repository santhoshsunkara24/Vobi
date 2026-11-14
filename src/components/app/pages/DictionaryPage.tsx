import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { notify } from "@/stores/noticeStore";
import { useSettings } from "@/hooks/useSettings";
import { isComposingKeyEvent } from "@/lib/utils/keyboard";
import { CloseIcon, SparkIcon } from "../icons";

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
  const { t } = useTranslation();
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

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word || word.length > MAX_LENGTH) return;
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
    <section className="v-page">
      <div className="v-top">
        <div className="flex-1">
          <h1>{t("vobi.dictionary.title")}</h1>
          <div className="v-sub">{t("vobi.dictionary.sub")}</div>
        </div>
      </div>

      <form onSubmit={add} className="mb-[20px] flex gap-[8px]">
        <input
          ref={inputRef}
          className="v-field max-w-[360px] flex-1"
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
        <button
          type="submit"
          className="v-btn v-btn-ink"
          disabled={!word || word.length > MAX_LENGTH || busy}
        >
          {t("vobi.dictionary.add")}
        </button>
      </form>

      {words.length > 0 ? (
        <div className="v-chips">
          {words.map((w) => (
            <span key={w} className={`v-chip ${leaving.has(w) ? "v-out" : ""}`}>
              {w}
              <button
                type="button"
                onClick={() => remove(w)}
                aria-label={t("settings.advanced.customWords.remove", {
                  word: w,
                })}
              >
                <CloseIcon />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="m-0 text-[13.5px] text-ink-3">
          {t("vobi.dictionary.empty")}
        </p>
      )}

      <div className="v-card mt-[26px] flex items-center gap-[14px] px-[18px] py-[16px]">
        <span
          className="v-plus"
          style={{ background: "var(--grad)", color: "#fff" }}
          aria-hidden="true"
        >
          <SparkIcon />
        </span>
        <div>
          <b className="text-[14.5px] font-semibold">
            {t("vobi.dictionary.tipTitle")}
          </b>
          <div className="text-[13px] text-ink-3">
            {t("vobi.dictionary.tipBody")}
          </div>
        </div>
      </div>
    </section>
  );
};
