import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash, Zap } from "@hexline/bicon/react";
import type { Snippet } from "@/bindings";
import { useSettings } from "@/hooks/useSettings";
import { PageFrame } from "../PageFrame";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Say a short phrase, get the full text. Snippets are saved in settings
 * (`snippets`), but nothing expands them yet.
 * TODO(snippets): expand triggers in the transcription pipeline.
 */
export const SnippetsPage: React.FC<{ autoFocus?: boolean }> = ({
  autoFocus = false,
}) => {
  const { t, i18n } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const snippets: Snippet[] = getSetting("snippets") ?? [];
  const [adding, setAdding] = useState(autoFocus);
  const [trigger, setTrigger] = useState("");
  const [text, setText] = useState("");
  const triggerRef = useRef<HTMLInputElement>(null);
  const busy = isUpdating("snippets");

  useEffect(() => {
    if (adding) triggerRef.current?.focus();
  }, [adding]);

  const close = () => {
    setAdding(false);
    setTrigger("");
    setText("");
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trigger.trim() || !text.trim()) return;
    updateSetting("snippets", [
      ...snippets,
      { id: newId(), trigger: trigger.trim(), text: text.trim() },
    ]);
    close();
  };

  const remove = (id: string) =>
    updateSetting(
      "snippets",
      snippets.filter((s) => s.id !== id),
    );

  return (
    <PageFrame
      title={t("vobi.snippets.title")}
      count={t("vobi.snippets.count", {
        count: snippets.length,
        n: new Intl.NumberFormat(i18n.language).format(snippets.length),
      })}
      actions={
        <button
          type="button"
          className="v-pill"
          onClick={() =>
            adding ? triggerRef.current?.focus() : setAdding(true)
          }
        >
          <Plus size={20} strokeWidth={1.6} />
          {t("vobi.snippets.new")}
        </button>
      }
    >
      <div className="v-stack">
        {adding && (
          <form
            onSubmit={save}
            className="v-card v-card-pad flex animate-rise flex-col gap-[12px]"
          >
            <input
              ref={triggerRef}
              className="v-field"
              value={trigger}
              maxLength={60}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder={t("vobi.snippets.triggerPlaceholder")}
              aria-label={t("vobi.snippets.trigger")}
            />
            <textarea
              className="v-field"
              rows={3}
              value={text}
              maxLength={2000}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("vobi.snippets.textPlaceholder")}
              aria-label={t("vobi.snippets.text")}
            />
            <div className="flex justify-end gap-[8px]">
              <button
                type="button"
                className="v-btn v-btn-soft v-btn-sm"
                onClick={close}
              >
                {t("vobi.snippets.cancel")}
              </button>
              <button
                type="submit"
                className="v-btn v-btn-ink v-btn-sm"
                disabled={!trigger.trim() || !text.trim() || busy}
              >
                {t("vobi.snippets.save")}
              </button>
            </div>
          </form>
        )}

        {snippets.length > 0 ? (
          <section className="v-card v-list">
            {snippets.map((s) => (
              <div key={s.id} className="v-row items-center">
                <span
                  className="v-badge"
                  data-tone="snippet"
                  aria-hidden="true"
                >
                  <Zap size={20} strokeWidth={1.5} />
                </span>
                <div className="v-row-main">
                  <div className="v-row-top">
                    <b>{s.trigger}</b>
                  </div>
                  <p className="v-row-text" data-clamp="" title={s.text}>
                    {s.text}
                  </p>
                </div>
                <span className="v-row-hover">
                  <button
                    type="button"
                    className="v-icon-btn"
                    onClick={() => remove(s.id)}
                    disabled={busy}
                    aria-label={t("vobi.snippets.remove", {
                      trigger: s.trigger,
                    })}
                    title={t("vobi.snippets.remove", { trigger: s.trigger })}
                  >
                    <Trash size={18} strokeWidth={1.5} />
                  </button>
                </span>
              </div>
            ))}
          </section>
        ) : (
          !adding && (
            <div className="v-card v-empty">{t("vobi.snippets.empty")}</div>
          )
        )}

        <p className="m-0 ms-[6px] text-[13px] text-ink-3">
          {t("vobi.snippets.soon")}
        </p>
      </div>
    </PageFrame>
  );
};
